#!/usr/bin/env node
/**
 * Manual Slug Fixer - Run this yourself to fix specific duplicate slugs
 * 
 * Usage Examples:
 * node scripts/manual-slug-fixer.js --list-duplicates
 * node scripts/manual-slug-fixer.js --fix-slug "3-bedroom-flat-apartment-for-rent"
 * node scripts/manual-slug-fixer.js --fix-all-duplicates
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, updateDoc, doc, query, where } = require('firebase/firestore');

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

// Slugify function
function slugify(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

// Generate unique slug
function generateUniqueSlug(title, docId) {
  if (!title || !docId) return '';
  const baseSlug = slugify(title);
  const shortId = docId.substring(0, 8);
  return `${baseSlug}-${shortId}`;
}

// List all duplicate slugs
async function listDuplicates() {
  console.log('ðŸ” Finding duplicate slugs...');
  
  try {
    const snapshot = await getDocs(collection(db, 'properties'));
    const slugCounts = {};
    const properties = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const slug = data.slug || '';
      properties.push({ id: doc.id, data });
      slugCounts[slug] = (slugCounts[slug] || 0) + 1;
    });
    
    const duplicateSlugs = Object.keys(slugCounts).filter(slug => slugCounts[slug] > 1);
    
    if (duplicateSlugs.length === 0) {
      console.log('âœ… No duplicate slugs found!');
      return;
    }
    
    console.log(`\\nâŒ Found ${duplicateSlugs.length} duplicate slugs:`);
    
    duplicateSlugs.forEach(slug => {
      console.log(`\\nðŸ“ Slug: "${slug}" (used ${slugCounts[slug]} times)`);
      const duplicateProperties = properties.filter(p => p.data.slug === slug);
      
      duplicateProperties.forEach((prop, index) => {
        console.log(`  ${index + 1}. ID: ${prop.id} | Title: "${prop.data.title}"`);
        console.log(`     Suggested new slug: "${generateUniqueSlug(prop.data.title, prop.id)}"`);
      });
    });
    
    console.log(`\\nðŸ’¡ To fix a specific slug, run:`);
    console.log(`node scripts/manual-slug-fixer.js --fix-slug "slug-name-here"`);
    
  } catch (error) {
    console.error('âŒ Error:', error.message);
  }
}

// Fix a specific duplicate slug
async function fixSlug(targetSlug) {
  console.log(`ðŸ”§ Fixing properties with slug: "${targetSlug}"`);
  
  try {
    const q = query(collection(db, 'properties'), where('slug', '==', targetSlug));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log('âŒ No properties found with that slug');
      return;
    }
    
    if (snapshot.size === 1) {
      console.log('âœ… Only one property found with that slug - no duplicates!');
      return;
    }
    
    console.log(`ðŸ“ Found ${snapshot.size} properties with duplicate slug:`);
    
    const updates = [];
    snapshot.forEach((doc, index) => {
      const data = doc.data();
      const newSlug = generateUniqueSlug(data.title, doc.id);
      
      console.log(`\\n  ${index + 1}. ID: ${doc.id}`);
      console.log(`     Title: "${data.title}"`);
      console.log(`     Old slug: "${data.slug}"`);
      console.log(`     New slug: "${newSlug}"`);
      
      updates.push({
        id: doc.id,
        newSlug: newSlug,
        title: data.title
      });
    });
    
    // Ask for confirmation
    console.log(`\\nâ“ Do you want to update these ${updates.length} properties? (y/N)`);
    
    // In a real scenario, you'd use readline, but for simplicity:
    console.log('\\nâš ï¸  Add --confirm flag to actually perform the update');
    console.log('Example: node scripts/manual-slug-fixer.js --fix-slug "your-slug" --confirm');
    
    if (process.argv.includes('--confirm')) {
      console.log('\\nðŸš€ Updating properties...');
      
      for (const update of updates) {
        try {
          await updateDoc(doc(db, 'properties', update.id), {
            slug: update.newSlug,
            updatedAt: new Date()
          });
          console.log(`âœ… Updated: ${update.id} -> "${update.newSlug}"`);
        } catch (error) {
          console.error(`âŒ Failed to update ${update.id}: ${error.message}`);
        }
      }
      
      console.log('\\nðŸŽ‰ Slug fixing completed!');
    }
    
  } catch (error) {
    console.error('âŒ Error:', error.message);
  }
}

// Fix ALL duplicate slugs
async function fixAllDuplicates() {
  console.log('ðŸ”§ Fixing ALL duplicate slugs...');
  
  try {
    const snapshot = await getDocs(collection(db, 'properties'));
    const slugCounts = {};
    const properties = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const slug = data.slug || '';
      properties.push({ id: doc.id, data });
      slugCounts[slug] = (slugCounts[slug] || 0) + 1;
    });
    
    const duplicateSlugs = Object.keys(slugCounts).filter(slug => slugCounts[slug] > 1);
    
    if (duplicateSlugs.length === 0) {
      console.log('âœ… No duplicate slugs found!');
      return;
    }
    
    console.log(`ðŸ“ Found ${duplicateSlugs.length} duplicate slugs affecting ${duplicateSlugs.reduce((sum, slug) => sum + slugCounts[slug], 0)} properties`);
    
    if (!process.argv.includes('--confirm')) {
      console.log('\\nâš ï¸  Add --confirm flag to actually perform the update');
      console.log('Example: node scripts/manual-slug-fixer.js --fix-all-duplicates --confirm');
      return;
    }
    
    console.log('\\nðŸš€ Updating all duplicate slugs...');
    let updated = 0;
    let errors = 0;
    
    for (const targetSlug of duplicateSlugs) {
      const duplicateProperties = properties.filter(p => p.data.slug === targetSlug);
      
      for (const prop of duplicateProperties) {
        try {
          const newSlug = generateUniqueSlug(prop.data.title, prop.id);
          await updateDoc(doc(db, 'properties', prop.id), {
            slug: newSlug,
            updatedAt: new Date()
          });
          console.log(`âœ… Updated: ${prop.id} | "${prop.data.title}" -> "${newSlug}"`);
          updated++;
        } catch (error) {
          console.error(`âŒ Failed to update ${prop.id}: ${error.message}`);
          errors++;
        }
      }
    }
    
    console.log(`\\nðŸŽ‰ Completed! Updated: ${updated}, Errors: ${errors}`);
    
  } catch (error) {
    console.error('âŒ Error:', error.message);
  }
}

// Parse command line arguments
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--list-duplicates') || args.length === 0) {
    await listDuplicates();
  } else if (args.includes('--fix-slug')) {
    const slugIndex = args.indexOf('--fix-slug');
    const targetSlug = args[slugIndex + 1];
    if (!targetSlug) {
      console.error('âŒ Please provide a slug to fix');
      console.log('Example: node scripts/manual-slug-fixer.js --fix-slug "3-bedroom-flat-apartment-for-rent"');
      return;
    }
    await fixSlug(targetSlug);
  } else if (args.includes('--fix-all-duplicates')) {
    await fixAllDuplicates();
  } else {
    console.log('ðŸ“– Usage:');
    console.log('  node scripts/manual-slug-fixer.js --list-duplicates');
    console.log('  node scripts/manual-slug-fixer.js --fix-slug "slug-name"');
    console.log('  node scripts/manual-slug-fixer.js --fix-slug "slug-name" --confirm');
    console.log('  node scripts/manual-slug-fixer.js --fix-all-duplicates --confirm');
  }
  
  process.exit(0);
}

// Run the script
main().catch(error => {
  console.error('âŒ Script failed:', error);
  process.exit(1);
});
