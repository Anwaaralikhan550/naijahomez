#!/usr/bin/env node
/**
 * Script to fix duplicate property slugs by making them unique
 * Uses property ID to ensure uniqueness
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, updateDoc, doc } = require('firebase/firestore');

// Your Firebase config
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || "your_api_key_here",
  authDomain: "nijahomzs-1ead3.firebaseapp.com",
  projectId: "nijahomzs-1ead3",
  storageBucket: "nijahomzs-1ead3.firebasestorage.app",
  messagingSenderId: "495544413710",
  appId: "1:495544413710:web:32c35206f5dfef2cedd65f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Slugify function (copied from utils)
function slugify(text) {
  if (!text) return '';
  
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text
}

// Generate unique slug with document ID
function generateUniqueSlug(title, docId) {
  if (!title || !docId) return '';
  
  const baseSlug = slugify(title);
  // Take the first 8 characters of the ID for brevity
  const shortId = docId.substring(0, 8);
  return `${baseSlug}-${shortId}`;
}

async function fixDuplicateSlugs() {
  console.log('ðŸ”§ Starting to fix duplicate property slugs...');
  
  try {
    // Get all properties
    const propertiesSnapshot = await getDocs(collection(db, 'properties'));
    const totalProperties = propertiesSnapshot.size;
    
    console.log(`ðŸ“ Found ${totalProperties} properties to process`);
    
    // Track slugs to identify duplicates
    const slugCounts = {};
    const properties = [];
    
    // First pass: collect all properties and count slug occurrences
    propertiesSnapshot.forEach(propertyDoc => {
      const propertyData = propertyDoc.data();
      const propertyId = propertyDoc.id;
      
      properties.push({
        id: propertyId,
        data: propertyData
      });
      
      const currentSlug = propertyData.slug || '';
      slugCounts[currentSlug] = (slugCounts[currentSlug] || 0) + 1;
    });
    
    // Find duplicate slugs
    const duplicateSlugs = Object.keys(slugCounts).filter(slug => slugCounts[slug] > 1);
    console.log(`âŒ Found ${duplicateSlugs.length} duplicate slugs affecting ${duplicateSlugs.reduce((sum, slug) => sum + slugCounts[slug], 0)} properties`);
    
    if (duplicateSlugs.length > 0) {
      console.log('Duplicate slugs:', duplicateSlugs.slice(0, 10).map(slug => `"${slug}" (${slugCounts[slug]} times)`).join(', '));
      if (duplicateSlugs.length > 10) {
        console.log(`... and ${duplicateSlugs.length - 10} more`);
      }
    }
    
    let processedCount = 0;
    let updatedCount = 0;
    let errors = [];
    
    // Second pass: update all properties with unique slugs
    for (const property of properties) {
      processedCount++;
      console.log(`\\n[${processedCount}/${totalProperties}] Processing: ${property.id}`);
      console.log(`  ðŸ“ Title: "${property.data.title || 'No title'}"`);
      console.log(`  ðŸ”— Current slug: "${property.data.slug || 'No slug'}"`);
      
      // Generate new unique slug
      const newSlug = generateUniqueSlug(property.data.title || 'property', property.id);
      console.log(`  âœ¨ New slug: "${newSlug}"`);
      
      // Only update if slug has changed
      if (property.data.slug !== newSlug) {
        try {
          await updateDoc(doc(db, 'properties', property.id), {
            slug: newSlug,
            updatedAt: new Date()
          });
          updatedCount++;
          console.log(`  âœ… Updated successfully`);
        } catch (error) {
          const errorMsg = `Failed to update ${property.id}: ${error.message}`;
          errors.push(errorMsg);
          console.error(`  âŒ ${errorMsg}`);
        }
      } else {
        console.log(`  âž– No change needed`);
      }
      
      // Add small delay to avoid overwhelming Firestore
      if (processedCount % 10 === 0) {
        console.log(`â³ Processed ${processedCount} properties... taking a brief pause`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log('\\nðŸŽ‰ Slug fixing completed!');
    console.log(`ðŸ“Š Summary:`);
    console.log(`  - Total properties processed: ${processedCount}`);
    console.log(`  - Properties updated: ${updatedCount}`);
    console.log(`  - Properties unchanged: ${processedCount - updatedCount}`);
    console.log(`  - Errors encountered: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('\\nâŒ Errors:');
      errors.forEach(error => console.log(`  - ${error}`));
    }
    
    // Verify no duplicates remain
    console.log('\\nðŸ” Verifying no duplicate slugs remain...');
    const verificationSnapshot = await getDocs(collection(db, 'properties'));
    const finalSlugs = {};
    
    verificationSnapshot.forEach(doc => {
      const slug = doc.data().slug;
      if (slug) {
        finalSlugs[slug] = (finalSlugs[slug] || 0) + 1;
      }
    });
    
    const remainingDuplicates = Object.keys(finalSlugs).filter(slug => finalSlugs[slug] > 1);
    
    if (remainingDuplicates.length === 0) {
      console.log('âœ… SUCCESS: No duplicate slugs found!');
    } else {
      console.log(`âš ï¸  WARNING: ${remainingDuplicates.length} duplicate slugs still exist:`, remainingDuplicates);
    }
    
  } catch (error) {
    console.error('âŒ Script failed:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  fixDuplicateSlugs()
    .then(() => {
      console.log('âœ… Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('âŒ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixDuplicateSlugs };
