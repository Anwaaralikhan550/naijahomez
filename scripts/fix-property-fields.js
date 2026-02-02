const { getAdminFirestore } = require('../src/lib/firebase-admin');

// Use admin SDK instead of client SDK for better performance
const db = getAdminFirestore();

let totalProcessed = 0;
let totalUpdated = 0;
let totalSkipped = 0;
let totalErrors = 0;

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
    
    if (titleLower.includes('flat') || titleLower.includes('apartment')) {
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
    } else if (titleLower.includes('room') || titleLower.includes('mini flat') ||
               titleLower.includes('self contain') || titleLower.includes('studio')) {
        return 'apartment';
    }
    
    // Default to house for bedrooms mentioned
    if (titleLower.match(/\d+\s*bedroom/)) {
        return titleLower.includes('flat') ? 'apartment' : 'house';
    }
    
    return 'house';
}

async function processPropertiesBatch(lastDoc = null) {
    try {
        console.log(`\n--- Processing batch (starting after doc: ${lastDoc?.id || 'beginning'}) ---`);
        
        let propertyQuery = db.collection('properties').limit(500);
        if (lastDoc) {
            propertyQuery = propertyQuery.startAfter(lastDoc);
        }
        
        const snapshot = await propertyQuery.get();
        
        if (snapshot.empty) {
            console.log('No more properties to process');
            return null;
        }
        
        const batch = db.batch();
        let batchUpdates = 0;
        
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const updates = {};
            let needsUpdate = false;
            
            totalProcessed++;
            
            // Fix propertyType field
            if (!data.propertyType) {
                if (data.type === 'property' || !data.type) {
                    updates.propertyType = determinePropertyType(data.title);
                    needsUpdate = true;
                }
            }
            
            // Remove incorrect 'type' field if it's just "property"
            if (data.type === 'property') {
                updates.type = null;
                needsUpdate = true;
            }
            
            // Add priceNumeric field
            if (!data.priceNumeric && data.rate) {
                const numericPrice = parsePrice(data.rate);
                if (numericPrice) {
                    updates.priceNumeric = numericPrice;
                    needsUpdate = true;
                }
            }
            
            // Add updatedAt timestamp
            if (needsUpdate) {
                updates.updatedAt = new Date();
                batch.update(db.collection('properties').doc(docSnap.id), updates);
                batchUpdates++;
                totalUpdated++;
                
                if (totalProcessed % 100 === 0) {
                    console.log(`Processed ${totalProcessed} properties. Updates queued: ${batchUpdates}`);
                }
            } else {
                totalSkipped++;
            }
        });
        
        if (batchUpdates > 0) {
            console.log(`Committing ${batchUpdates} updates to Firestore...`);
            await batch.commit();
            console.log(`✅ Batch committed successfully`);
        } else {
            console.log('No updates needed for this batch');
        }
        
        // Return last document for pagination
        return snapshot.docs[snapshot.docs.length - 1];
        
    } catch (error) {
        console.error('Error processing batch:', error);
        totalErrors++;
        throw error;
    }
}

async function startMigration() {
    try {
        console.log('🚀 Starting property field migration...');
        console.log('This will fix:');
        console.log('- Missing propertyType fields');
        console.log('- Incorrect type: "property" fields');
        console.log('- Missing priceNumeric fields');
        console.log('');
        
        let lastDoc = null;
        let batchCount = 0;
        
        while (true) {
            batchCount++;
            console.log(`\n📦 Processing batch ${batchCount}...`);
            
            lastDoc = await processPropertiesBatch(lastDoc);
            
            if (!lastDoc) {
                break; // No more documents
            }
            
            // Small delay between batches to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        console.log('\n🎉 Migration completed successfully!');
        console.log('='.repeat(50));
        console.log(`📊 Final Results:`);
        console.log(`   Total processed: ${totalProcessed}`);
        console.log(`   Total updated: ${totalUpdated}`);
        console.log(`   Total skipped: ${totalSkipped}`);
        console.log(`   Total errors: ${totalErrors}`);
        console.log('='.repeat(50));
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        console.log('\n📊 Results before failure:');
        console.log(`   Total processed: ${totalProcessed}`);
        console.log(`   Total updated: ${totalUpdated}`);
        console.log(`   Total skipped: ${totalSkipped}`);
        console.log(`   Total errors: ${totalErrors}`);
        process.exit(1);
    }
}

// Run the migration
startMigration();