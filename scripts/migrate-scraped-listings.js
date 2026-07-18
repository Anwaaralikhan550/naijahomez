#!/usr/bin/env node

/**
 * Migration script to clean up scraped listings data
 * This script helps standardize the scraped listings and add missing fields
 * 
 * Usage: node scripts/migrate-scraped-listings.js [--dry-run] [--collection=properties]
 */

const { initializeApp } = require('firebase/app');
const { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  writeBatch
} = require('firebase/firestore');

// Firebase config (you might want to use environment variables)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const collectionArg = args.find(arg => arg.startsWith('--collection='));
const targetCollection = collectionArg ? collectionArg.split('=')[1] : null;

// Collections to process
const collections = targetCollection ? [targetCollection] : [
  'properties', 
  'marketplace', 
  'services', 
  'housemates', 
  'noticeboard'
];

// System user ID for orphaned listings
const SYSTEM_USER_ID = 'system-scraped-listings';

/**
 * Check if a listing appears to be scraped data
 */
function isScrapedListing(listing) {
  return !listing.userId || 
         listing.userId === 'unknown' || 
         listing.userId === '' ||
         !listing.userEmail ||
         listing.dataSource === 'scraped';
}

/**
 * Standardize phone number format
 */
function standardizePhoneNumber(phone) {
  if (!phone) return null;
  
  const digits = phone.replace(/\D/g, '');
  
  // Nigerian number formatting
  if (digits.length === 10) {
    return `+234${digits}`;
  } else if (digits.length === 11 && digits.startsWith('0')) {
    return `+234${digits.substring(1)}`;
  } else if (digits.length === 13 && digits.startsWith('234')) {
    return `+${digits}`;
  }
  
  return phone; // Return original if format is unclear
}

/**
 * Process a single listing
 */
function processListing(listing, docId) {
  const updates = {};
  let needsUpdate = false;

  // Mark as scraped if it appears to be scraped data
  if (isScrapedListing(listing)) {
    updates.dataSource = 'scraped';
    updates.userId = SYSTEM_USER_ID;
    updates.isScrapedData = true;
    needsUpdate = true;
  }

  // Standardize phone number
  if (listing.phoneNumber) {
    const standardized = standardizePhoneNumber(listing.phoneNumber);
    if (standardized !== listing.phoneNumber) {
      updates.phoneNumber = standardized;
      needsUpdate = true;
    }
  }

  // Add missing slug if needed
  if (!listing.slug && listing.title) {
    const slug = listing.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') + `-${docId.substring(0, 8)}`;
    updates.slug = slug;
    needsUpdate = true;
  }

  // Ensure createdAt exists
  if (!listing.createdAt) {
    updates.createdAt = new Date();
    needsUpdate = true;
  }

  // Add updatedAt
  updates.updatedAt = new Date();
  needsUpdate = true;

  return needsUpdate ? updates : null;
}

function normalizeForDedup(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Process a collection
 */
async function processCollection(collectionName) {
  console.log(`\n📁 Processing collection: ${collectionName}`);
  
  try {
    const collectionRef = collection(db, collectionName);
    const snapshot = await getDocs(collectionRef);
    
    console.log(`   Found ${snapshot.docs.length} documents`);
    
    let processedCount = 0;
    let updatedCount = 0;
    let scrapedCount = 0;
    
    let batch = writeBatch(db);
    let batchOps = 0;
    const MAX_BATCH_SIZE = 500;
    const seenByTitleLocation = new Map();
    let duplicateCount = 0;
    let deletedCount = 0;

    for (const document of snapshot.docs) {
      const listing = document.data();
      const titleKey = normalizeForDedup(listing.title);
      const locationKey = normalizeForDedup(listing.location);
      const dedupKey = `${titleKey}::${locationKey}`;

      if (titleKey && locationKey) {
        if (seenByTitleLocation.has(dedupKey)) {
          duplicateCount++;

          if (!isDryRun) {
            batch.delete(doc(db, collectionName, document.id));
            batchOps++;
            deletedCount++;
          }

          processedCount++;
          if (processedCount % 100 === 0) {
            console.log(`   Processed ${processedCount}/${snapshot.docs.length} documents`);
          }
          continue;
        }

        seenByTitleLocation.set(dedupKey, document.id);
      }

      const updates = processListing(listing, document.id);
      
      if (updates) {
        if (updates.isScrapedData) {
          scrapedCount++;
        }
        
        if (!isDryRun) {
          batch.update(doc(db, collectionName, document.id), updates);
          batchOps++;
          
          // Commit batch if it's getting too large
          if (batchOps >= MAX_BATCH_SIZE) {
            await batch.commit();
            console.log(`   💾 Committed batch of ${batchOps} updates`);
            batch = writeBatch(db);
            batchOps = 0;
          }
        }
        
        updatedCount++;
      }
      
      processedCount++;
      
      // Progress indicator
      if (processedCount % 100 === 0) {
            console.log(`   Processed ${processedCount}/${snapshot.docs.length} documents`);
      }
    }
    
    // Commit remaining updates
    if (!isDryRun && batchOps > 0) {
      await batch.commit();
      console.log(`   💾 Committed final batch of ${batchOps} updates`);
    }
    
    console.log(`   ✅ Collection complete:`);
    console.log(`      - Processed: ${processedCount} documents`);
    console.log(`      - Updated: ${updatedCount} documents`);
    console.log(`      - Duplicates found (title+location): ${duplicateCount} documents`);
    console.log(`      - Duplicates deleted: ${deletedCount} documents`);
    console.log(`      - Scraped listings found: ${scrapedCount} documents`);
    
    return { processedCount, updatedCount, scrapedCount, duplicateCount, deletedCount };
    
  } catch (error) {
    console.error(`   ❌ Error processing ${collectionName}:`, error);
    return { processedCount: 0, updatedCount: 0, scrapedCount: 0, duplicateCount: 0, deletedCount: 0 };
  }
}

/**
 * Main migration function
 */
async function runMigration() {
  console.log('🚀 Starting scraped listings migration...');
  console.log(`   Mode: ${isDryRun ? 'DRY RUN (no changes will be made)' : 'LIVE UPDATE'}`);
  console.log(`   Collections: ${collections.join(', ')}`);
  
  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalScraped = 0;
  let totalDuplicates = 0;
  let totalDeleted = 0;
  
  for (const collectionName of collections) {
    const results = await processCollection(collectionName);
    totalProcessed += results.processedCount;
    totalUpdated += results.updatedCount;
    totalScraped += results.scrapedCount;
    totalDuplicates += results.duplicateCount;
    totalDeleted += results.deletedCount;
  }
  
  console.log('\n📊 Migration Summary:');
  console.log(`   Total documents processed: ${totalProcessed}`);
  console.log(`   Total documents updated: ${totalUpdated}`);
  console.log(`   Total duplicates found (title+location): ${totalDuplicates}`);
  console.log(`   Total duplicates deleted: ${totalDeleted}`);
  console.log(`   Total scraped listings identified: ${totalScraped}`);
  console.log(`   Mode: ${isDryRun ? 'DRY RUN' : 'LIVE UPDATE'}`);
  
  if (isDryRun) {
    console.log('\n💡 This was a dry run. To apply changes, run without --dry-run flag');
  } else {
    console.log('\n✅ Migration completed successfully!');
  }
}

// Help text
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
📋 Scraped Listings Migration Script

Usage: node scripts/migrate-scraped-listings.js [options]

Options:
  --dry-run                 Preview changes without applying them
  --collection=<name>       Process only specific collection (properties, marketplace, etc.)
  --help, -h               Show this help message

Examples:
  node scripts/migrate-scraped-listings.js --dry-run
  node scripts/migrate-scraped-listings.js --collection=properties
  node scripts/migrate-scraped-listings.js --collection=marketplace --dry-run
  
This script will:
✅ Identify scraped listings (no userId or userEmail)
✅ Standardize phone number formats
✅ Add missing slugs
✅ Add system userId for orphaned listings
✅ Add timestamps for tracking
  `);
  process.exit(0);
}

// Run the migration
runMigration().catch(error => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
