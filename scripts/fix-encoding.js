#!/usr/bin/env node

/**
 * fix-encoding.js — Firestore data migration script
 *
 * Detects and repairs UTF-8 mojibake in property listing fields.
 * Common pattern: Nigerian flag emoji 🇳🇬 stored as garbled Latin-1
 * characters (ð\x9F\x87³ð\x9F\x87¬) instead of proper UTF-8.
 *
 * Usage:
 *   node scripts/fix-encoding.js --dry-run   # Preview changes (no writes)
 *   node scripts/fix-encoding.js              # Apply fixes to Firestore
 *
 * Requires FIREBASE_SERVICE_ACCOUNT_KEY or individual Firebase env vars.
 */

const admin = require('firebase-admin');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

// Initialize Firebase Admin
function initFirebase() {
  if (admin.apps.length) return admin.firestore();

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountKey) {
    const serviceAccount = JSON.parse(serviceAccountKey);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (!projectId || !clientEmail || !privateKey) {
      console.error('Missing Firebase credentials. Set FIREBASE_SERVICE_ACCOUNT_KEY or individual vars.');
      process.exit(1);
    }
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  }
  return admin.firestore();
}

// Detect mojibake
function hasMojibake(str) {
  if (!str || typeof str !== 'string') return false;
  return /[\u00C0-\u00F4][\u0080-\u00BF]/.test(str);
}

// Repair mojibake string
function fixMojibakeString(str) {
  if (!str || typeof str !== 'string') return str;
  if (!hasMojibake(str)) return str;

  try {
    const bytes = Buffer.from(str, 'latin1');
    const decoded = bytes.toString('utf8');
    if (decoded.length < str.length) {
      return decoded;
    }
    return str;
  } catch {
    return str;
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`\n=== Firestore Encoding Fix ${dryRun ? '(DRY RUN)' : '(LIVE)'} ===\n`);

  const db = initFirebase();
  const textFields = ['location', 'title', 'originalDescription', 'address'];
  const collections = ['properties', 'housemates', 'marketplace', 'tradespeople', 'noticeboard'];

  let totalScanned = 0;
  let totalFixed = 0;
  let totalErrors = 0;

  for (const collectionName of collections) {
    console.log(`\nScanning collection: ${collectionName}`);
    let collFixed = 0;
    let collScanned = 0;

    const collRef = db.collection(collectionName);
    const batchSize = 500;
    let lastDoc = null;

    while (true) {
      let query = collRef.orderBy('__name__').limit(batchSize);
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();
      if (snapshot.empty) break;

      const batch = db.batch();
      let batchCount = 0;

      for (const doc of snapshot.docs) {
        collScanned++;
        totalScanned++;
        const data = doc.data();
        const updates = {};

        for (const field of textFields) {
          if (data[field] && typeof data[field] === 'string' && hasMojibake(data[field])) {
            const fixed = fixMojibakeString(data[field]);
            if (fixed !== data[field]) {
              updates[field] = fixed;
            }
          }
        }

        if (Object.keys(updates).length > 0) {
          collFixed++;
          totalFixed++;
          console.log(`  [${dryRun ? 'WOULD FIX' : 'FIXING'}] ${doc.id}`);
          for (const [field, value] of Object.entries(updates)) {
            console.log(`    ${field}: "${data[field].substring(0, 60)}..." → "${value.substring(0, 60)}..."`);
          }

          if (!dryRun) {
            batch.update(doc.ref, updates);
            batchCount++;
          }
        }
      }

      if (!dryRun && batchCount > 0) {
        try {
          await batch.commit();
        } catch (err) {
          console.error(`  ERROR committing batch: ${err.message}`);
          totalErrors++;
        }
      }

      lastDoc = snapshot.docs[snapshot.docs.length - 1];

      if (snapshot.docs.length < batchSize) break;
    }

    console.log(`  ${collectionName}: scanned=${collScanned}, fixed=${collFixed}`);
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total scanned: ${totalScanned}`);
  console.log(`Total fixed: ${totalFixed}`);
  console.log(`Total errors: ${totalErrors}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes made)' : 'LIVE (changes applied)'}\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
