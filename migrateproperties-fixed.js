// migrate.js
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, writeBatch, doc } from 'firebase/firestore';
import fs from 'fs/promises';
import sharp from 'sharp';
import axios from 'axios';
import { generateUniqueListingId } from './slugify.js';

// Use correct Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCeUNqySxbTnTtzyh8fUeWfzVAgckmrUIU",
    authDomain: "nijahomzs-1ead3.firebaseapp.com",
    projectId: "nijahomzs-1ead3",
    storageBucket: "nijahomzs-1ead3.firebasestorage.app",
    messagingSenderId: "495544413710",
    appId: "1:495544413710:web:32c35206f5dfef2cedd65f"
};

// AWS Configuration (you'll need to update these)
const awsConfig = {
    region: "eu-north-1", // Update with your region
    bucketName: "nijahomzs", // Update with your bucket name
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID, // Set in environment
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY // Set in environment
    }
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// Initialize S3 Client
const s3Client = new S3Client({
    region: awsConfig.region,
    credentials: awsConfig.credentials
});

// Progress tracking
let totalProperties = 0;
let processedProperties = 0;
let successfulProperties = 0;
let failedProperties = 0;
let totalImages = 0;
let processedImages = 0;
let successfulImages = 0;
let failedImages = 0;

// Configuration - no limits for full processing
const LIMIT_ENABLED = false;          // Disabled - will process all properties
const PROPERTY_LIMIT = Infinity;      // No limit on properties
const IMAGES_PER_PROPERTY_LIMIT = Infinity;  // No limit on images per property

let watermarkBuffer;

// Parse price string to numeric value
function parsePrice(priceStr) {
    if (!priceStr) return null;
    
    // Remove currency symbols, commas, and extra text
    let cleanPrice = priceStr
        .replace(/₦|N|\$|USD|NGN/gi, '')
        .replace(/,/g, '')
        .replace(/per annum|approx\.|per month/gi, '')
        .trim();
    
    // Extract first number found
    const match = cleanPrice.match(/[\d,]+\.?\d*/);
    if (match) {
        const numStr = match[0].replace(/,/g, '');
        const num = parseFloat(numStr);
        return isNaN(num) ? null : num;
    }
    
    return null;
}

// Determine property type from title
function determinePropertyType(title) {
    if (!title) return 'house';
    
    const titleLower = title.toLowerCase();
    
    if (titleLower.includes('flat') || titleLower.includes('apartment') || 
        titleLower.includes('self contain') || titleLower.includes('studio') ||
        titleLower.includes('mini flat') || titleLower.includes('room')) {
        return 'apartment';
    } else if (titleLower.includes('land') || titleLower.includes('plot')) {
        return 'land';
    } else if (titleLower.includes('duplex') || titleLower.includes('detached') || 
               titleLower.includes('semi-detached') || titleLower.includes('terraced') ||
               titleLower.includes('bungalow')) {
        return 'house';
    } else if (titleLower.includes('office') || titleLower.includes('shop') || 
               titleLower.includes('commercial') || titleLower.includes('warehouse')) {
        return 'commercial';
    }
    
    // Default to house for bedrooms mentioned
    if (titleLower.match(/\d+\s*bedroom/)) {
        return titleLower.includes('flat') ? 'apartment' : 'house';
    }
    
    return 'house';
}

// Convert string numbers to integers
function parseNumber(value, defaultValue = null) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value !== 'none' && value !== '') {
        const num = parseInt(value);
        return isNaN(num) ? defaultValue : num;
    }
    return defaultValue;
}

async function loadWatermark() {
    try {
        watermarkBuffer = await sharp('new-watermark.png')
            .ensureAlpha()
            .toBuffer();
        console.log('Watermark loaded successfully');
    } catch (error) {
        console.error('Error loading watermark:', error);
        process.exit(1);
    }
}

async function downloadImage(url) {
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(response.data);
    } catch (error) {
        console.error(`Error downloading image from ${url}:`, error.message);
        failedImages++;
        return null;
    }
}

async function processImage(imageBuffer) {
    try {
        const imageMetadata = await sharp(imageBuffer).metadata();
        console.log('Processing image:', imageMetadata.width, 'x', imageMetadata.height);

        const blurWidth = 200;
        const blurHeight = 60;

        const centerX = Math.round((imageMetadata.width - blurWidth) / 2);
        const centerY = Math.round((imageMetadata.height - blurHeight) / 2);

        // Create a blurred version of just the center area
        const blurredCenter = await sharp(imageBuffer)
            .extract({
                left: centerX,
                top: centerY,
                width: blurWidth,
                height: blurHeight
            })
            .blur(10)
            .toBuffer();

        // Create base image with blurred center
        const baseImage = await sharp(imageBuffer)
            .composite([{
                input: blurredCenter,
                top: centerY,
                left: centerX
            }])
            .toBuffer();

        // Apply watermark
        const processed = await sharp(baseImage)
            .composite([{
                input: await sharp(watermarkBuffer)
                    .resize(blurWidth, blurHeight, {
                        fit: 'fill'
                    })
                    .toBuffer(),
                top: centerY,
                left: centerX,
                blend: 'over',
                opacity: 0.85
            }])
            .jpeg({ 
                quality: 80
            })
            .toBuffer();

        return processed;
    } catch (error) {
        console.error('Error processing image:', error);
        failedImages++;
        return null;
    }
}

async function uploadToS3(buffer, filename) {
    try {
        const command = new PutObjectCommand({
            Bucket: awsConfig.bucketName,
            Key: `properties/${filename}`,
            Body: buffer,
            ContentType: 'image/jpeg',
            ACL: 'public-read'
        });

        await s3Client.send(command);
        const url = `https://${awsConfig.bucketName}.s3.${awsConfig.region}.amazonaws.com/properties/${filename}`;
        successfulImages++;
        return url;
    } catch (error) {
        console.error('Error uploading to S3:', error.message);
        failedImages++;
        throw error;
    }
}

async function saveToFirestore(batch, data) {
    try {
        const propertiesRef = collection(db, 'properties');
        const docRef = doc(propertiesRef);
        batch.set(docRef, data);
        return docRef.id;
    } catch (error) {
        console.error('Error preparing Firestore operation:', error.message);
        throw error;
    }
}

async function processProperty(property, index, batch) {
    try {
        if (!property.title || !property.imageUrls || property.imageUrls.length === 0) {
            console.log('Skipping property without title or images:', index + 1);
            failedProperties++;
            return null;
        }

        // Remove duplicate image URLs
        const uniqueImageUrls = [...new Set(property.imageUrls)];
        console.log(`Property ${index + 1}: ${uniqueImageUrls.length} unique images (${property.imageUrls.length} total)`);
        
        // Apply image limit if enabled
        const imagesToProcess = LIMIT_ENABLED 
            ? uniqueImageUrls.slice(0, IMAGES_PER_PROPERTY_LIMIT) 
            : uniqueImageUrls;
            
        totalImages += imagesToProcess.length;
        
        const processedUrls = [];
        
        for (const url of imagesToProcess) {
            try {
                console.log(`Downloading image: ${url}`);
                const imageBuffer = await downloadImage(url);
                if (!imageBuffer) continue;
                
                console.log('Processing image...');
                const processedImage = await processImage(imageBuffer);
                if (!processedImage) continue;
                
                const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
                console.log(`Uploading to S3 as: ${filename}`);
                const s3Url = await uploadToS3(processedImage, filename);
                if (s3Url) {
                    processedUrls.push(s3Url);
                    console.log(`Image uploaded successfully: ${s3Url}`);
                }
                processedImages++;
            } catch (error) {
                console.error(`Error processing image:`, error.message);
                continue;
            }
        }
        
        // Skip if no processed images
        if (processedUrls.length === 0) {
            console.log('No successfully processed images for this property. Skipping...');
            failedProperties++;
            return null;
        }

        // Parse numeric price from rate string
        const priceNumeric = parsePrice(property.rate);

        // Create a firestore document with CORRECT structure
        const propertyData = {
            title: property.title?.trim(),
            phoneNumber: property.phoneNumber?.trim(),
            location: property.location?.trim(),
            rate: property.rate?.trim(),
            priceNumeric: priceNumeric, // ✅ Add numeric price for sorting
            description: property.description || property.originalDescription,
            originalDescription: property.originalDescription,
            
            // ✅ Convert string numbers to integers
            bedrooms: parseNumber(property.bedrooms),
            bathrooms: parseNumber(property.bathrooms), 
            toilets: parseNumber(property.toilets),
            parkingSpaces: parseNumber(property.parkingSpaces),
            squareMeters: parseNumber(property.squareMeters),
            
            // ✅ Use propertyType instead of generic type
            propertyType: determinePropertyType(property.title),
            listingType: property.listingType,
            
            imageUrls: processedUrls,
            slug: property.slug || generateUniqueListingId({ 
                Title: property.title, 
                Location: property.location 
            }, index),
            createdAt: new Date(),
            updatedAt: new Date(),
            status: 'active',
            source: 'scraper'
        };

        // ✅ Log what we're creating
        console.log(`Creating property: ${propertyData.title}`);
        console.log(`  propertyType: ${propertyData.propertyType}`);
        console.log(`  priceNumeric: ${propertyData.priceNumeric}`);
        console.log(`  bedrooms: ${propertyData.bedrooms} (${typeof propertyData.bedrooms})`);

        await saveToFirestore(batch, propertyData);
        successfulProperties++;
        processedProperties++;
        
        // Log progress
        if (processedProperties % 5 === 0) {
            logProgress();
        }

        return propertyData;
    } catch (error) {
        console.error('Failed to process property:', error.message);
        failedProperties++;
        processedProperties++;
        return null;
    }
}

function logProgress() {
    console.log('\nProgress Update:');
    console.log(`Properties: ${processedProperties}/${totalProperties} (${successfulProperties} successful, ${failedProperties} failed)`);
    console.log(`Images: ${processedImages}/${totalImages} (${successfulImages} successful, ${failedImages} failed)`);
    console.log('----------------------------------------');
}

async function startMigration() {
    try {
        console.log('Starting migration from JSON to Firestore...');
        
        // Load watermark first
        await loadWatermark();
        
        // Read and parse JSON file
        const jsonData = await fs.readFile('firestore-properties.json', 'utf-8');
        const properties = JSON.parse(jsonData);
        console.log(`JSON file read successfully with ${properties.length} properties`);
        
        // Apply property limit if enabled
        const propertiesToProcess = LIMIT_ENABLED 
            ? properties.slice(0, PROPERTY_LIMIT) 
            : properties;
            
        totalProperties = propertiesToProcess.length;
        console.log(`Will process ${totalProperties} properties${LIMIT_ENABLED ? ' (LIMIT ENABLED)' : ''}`);

        // Process in batches of 10 for testing (use larger batches like 50-100 for production)
        const batchSize = 10;
        for (let i = 0; i < propertiesToProcess.length; i += batchSize) {
            const batch = writeBatch(db);
            const currentBatch = propertiesToProcess.slice(i, i + batchSize);
            
            console.log(`\nProcessing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(propertiesToProcess.length/batchSize)}...`);
            
            for (let j = 0; j < currentBatch.length; j++) {
                await processProperty(currentBatch[j], i + j, batch);
            }
            
            try {
                console.log(`Committing batch ${Math.floor(i/batchSize) + 1} to Firestore...`);
                await batch.commit();
                console.log(`Batch ${Math.floor(i/batchSize) + 1} committed to Firestore successfully`);
            } catch (error) {
                console.error('Error committing batch:', error);
                failedProperties += currentBatch.length - (successfulProperties - (processedProperties - currentBatch.length));
                processedProperties = i + batchSize > propertiesToProcess.length ? propertiesToProcess.length : i + batchSize;
            }
        }
        
        // Final progress report
        logProgress();
        console.log('\nMigration completed');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error.message);
        process.exit(1);
    }
}

// Run the migration
startMigration();