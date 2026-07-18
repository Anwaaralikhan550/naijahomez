#!/usr/bin/env node
/**
 * One-off cleanup: permanently delete junk/test housemate docs surfacing
 * on the homepage's "Find a Place to Live" section.
 *
 * Targets:
 *   1. title startsWith "QA_E2E_FINAL_Housemate_"
 *
 * Usage:
 *   node scripts/delete-junk-housemates.js            # dry-run, lists matches
 *   node scripts/delete-junk-housemates.js --apply    # actually deletes
 */

require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');

function initAdmin() {
  if (admin.apps.length) return;

  const sak = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (sak) {
    const sa = JSON.parse(sak);
    admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id });
    return;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Admin credentials missing in .env.local');
  }

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    projectId,
  });
}

const PREFIXES = ['QA_E2E_FINAL_Housemate_'];

async function findMatches(db) {
  const matches = new Map();
  const col = db.collection('housemates');

  for (const prefix of PREFIXES) {
    const end = prefix.slice(0, -1) +
      String.fromCharCode(prefix.charCodeAt(prefix.length - 1) + 1);
    const snap = await col
      .where('title', '>=', prefix)
      .where('title', '<', end)
      .get();
    snap.forEach(doc => matches.set(doc.id, doc));
  }

  return [...matches.values()];
}

async function main() {
  initAdmin();
  const db = admin.firestore();

  console.log(`Mode: ${APPLY ? 'APPLY (will delete permanently)' : 'DRY-RUN (no writes)'}\n`);

  const docs = await findMatches(db);

  if (docs.length === 0) {
    console.log('No matching documents found.');
    return;
  }

  console.log(`Found ${docs.length} matching document(s):\n`);
  for (const doc of docs) {
    const d = doc.data();
    console.log(`  - id=${doc.id}`);
    console.log(`    title="${d.title}"  roomType=${d.roomType}  location="${d.location}"  status=${d.status}`);
  }
  console.log('');

  if (!APPLY) {
    console.log('Re-run with --apply to permanently delete these documents.');
    return;
  }

  let deleted = 0;
  for (const doc of docs) {
    await doc.ref.delete();
    deleted++;
    console.log(`  deleted ${doc.id}`);
  }
  console.log(`\nDone. Permanently deleted ${deleted} document(s).`);
  console.log('Tip: GET /api/housemates results are cached for 5 min — restart dev server or wait.');
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
