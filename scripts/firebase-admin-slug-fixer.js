#!/usr/bin/env node
/**
 * BULK Slug Fixer using Firebase Admin SDK (bypasses permissions)
 * This uses the same admin credentials as your API routes
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = {
  type: "service_account",
  project_id: "nijahomzs-1ead3",
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: `https://www.googleapis.com/oauth2/v1/certs?gid=${process.env.FIREBASE_CLIENT_EMAIL}`
};

// Try to initialize admin SDK
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'nijahomzs-1ead3'
  });
  console.log('✅ Firebase Admin initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin:', error.message);
  console.log('\n💡 Make sure your .env.local has the Firebase Admin credentials:');
  console.log('FIREBASE_CLIENT_EMAIL=...');
  console.log('FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"');
  process.exit(1);
}

const db = admin.firestore();

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

async function bulkFixAllSlugs() {
  console.log('🚀 Starting BULK slug fixing...');
  
  try {
    // Get ALL properties
    console.log('📍 Fetching ALL properties...');
    const snapshot = await db.collection('properties').get();
    const totalProperties = snapshot.size;
    
    console.log(`📊 Found ${totalProperties} total properties`);
    
    // Find duplicates and properties needing updates
    const slugCounts = {};
    const propertiesToUpdate = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const currentSlug = data.slug || '';
      const expectedSlug = generateUniqueSlug(data.title || 'property', doc.id);
      
      // Count slug usage
      slugCounts[currentSlug] = (slugCounts[currentSlug] || 0) + 1;
      
      // Check if slug needs updating
      if (currentSlug !== expectedSlug || !currentSlug) {
        propertiesToUpdate.push({
          id: doc.id,
          title: data.title || 'Untitled Property',
          currentSlug,
          expectedSlug,
          isDuplicate: false // Will be set below
        });
      }
    });
    
    // Mark duplicates
    propertiesToUpdate.forEach(prop => {
      prop.isDuplicate = slugCounts[prop.currentSlug] > 1;
    });
    
    const duplicates = propertiesToUpdate.filter(p => p.isDuplicate);
    const needsUpdate = propertiesToUpdate.length;
    
    console.log(`\n📊 Analysis Complete:`);
    console.log(`  - Properties needing updates: ${needsUpdate}`);
    console.log(`  - Duplicate slugs to fix: ${duplicates.length}`);
    console.log(`  - Missing/invalid slugs: ${needsUpdate - duplicates.length}`);
    
    if (needsUpdate === 0) {
      console.log('🎉 All slugs are already unique and properly formatted!');
      return;
    }
    
    // Show some examples
    console.log(`\n📝 Examples of changes:`);
    propertiesToUpdate.slice(0, 5).forEach(prop => {
      console.log(`  "${prop.currentSlug || '<empty>'}" → "${prop.expectedSlug}"`);
      console.log(`    Title: "${prop.title}"`);
      console.log(`    ID: ${prop.id}\n`);
    });
    
    if (!process.argv.includes('--confirm')) {
      console.log('⚠️  Add --confirm flag to actually update the properties');
      console.log('Example: node scripts/firebase-admin-slug-fixer.js --confirm');
      return;
    }
    
    console.log('🚀 Starting bulk updates...');
    
    // Update in batches
    const BATCH_SIZE = 50;
    let updated = 0;
    let errors = 0;
    
    for (let i = 0; i < propertiesToUpdate.length; i += BATCH_SIZE) {
      const batch = propertiesToUpdate.slice(i, i + BATCH_SIZE);
      console.log(`\n📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(propertiesToUpdate.length / BATCH_SIZE)}`);
      
      // Create Firestore batch
      const firestoreBatch = db.batch();
      
      batch.forEach(prop => {
        const docRef = db.collection('properties').doc(prop.id);
        firestoreBatch.update(docRef, {
          slug: prop.expectedSlug,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });
      
      try {
        await firestoreBatch.commit();
        updated += batch.length;
        console.log(`  ✅ Updated ${batch.length} properties (${updated}/${propertiesToUpdate.length})`);
      } catch (error) {
        errors += batch.length;
        console.error(`  ❌ Failed to update batch: ${error.message}`);
        
        // Try individual updates as fallback
        console.log('  🔄 Trying individual updates...');
        for (const prop of batch) {
          try {
            await db.collection('properties').doc(prop.id).update({
              slug: prop.expectedSlug,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            updated++;
            errors--;
            console.log(`    ✅ Updated ${prop.id}`);
          } catch (individualError) {
            console.error(`    ❌ Failed ${prop.id}: ${individualError.message}`);
          }
        }
      }
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`\n🎉 Bulk update completed!`);
    console.log(`📊 Final Summary:`);
    console.log(`  - Successfully updated: ${updated}`);
    console.log(`  - Failed updates: ${errors}`);
    console.log(`  - Success rate: ${Math.round((updated / (updated + errors)) * 100)}%`);
    
    if (updated > 0) {
      console.log(`\n✨ Next steps:`);
      console.log(`  1. Clear cache: curl http://localhost:3000/api/cache/clear`);
      console.log(`  2. Test some property URLs to verify they work`);
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Parse arguments and run
async function main() {
  console.log('🔧 Firebase Admin Bulk Slug Fixer\n');
  
  if (process.argv.includes('--help')) {
    console.log('Usage:');
    console.log('  node scripts/firebase-admin-slug-fixer.js           # Dry run (show what would change)');
    console.log('  node scripts/firebase-admin-slug-fixer.js --confirm # Actually fix the slugs');
    return;
  }
  
  await bulkFixAllSlugs();
  process.exit(0);
}

main().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});