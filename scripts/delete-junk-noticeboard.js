#!/usr/bin/env node
/**
 * One-off cleanup: permanently delete junk/test noticeboard docs surfacing
 * on the homepage's "Community Noticeboard" section.
 *
 * Targets:
 *   1. title startsWith "QA_E2E_FINAL_Notice_"
 *   2. title === "E2E Test Notice - Community Event"
 *   3. title === 'Lost Golden Retriever - Answers to "Max"'
 *
 * Usage:
 *   node scripts/delete-junk-noticeboard.js            # dry-run, lists matches
 *   node scripts/delete-junk-noticeboard.js --apply    # actually deletes
 */

require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');

function initAdmin() {
  if (admin.apps.length) return;

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountKey) {
    const serviceAccount = JSON.parse(serviceAccountKey);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
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

const EXACT_TITLES = [
  'E2E Test Notice - Community Event',
  'Lost Golden Retriever - Answers to "Max"',
];

const PREFIXES = [
  'QA_E2E_FINAL_Notice_',
];

async function findMatches(db) {
  const matches = new Map();
  const col = db.collection('noticeboard');

  // Exact title matches
  for (const title of EXACT_TITLES) {
    const snap = await col.where('title', '==', title).get();
    snap.forEach(doc => matches.set(doc.id, doc));
  }

  // Prefix matches — Firestore doesn't have startsWith, use range trick
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
    console.log(`    title="${d.title}"  category=${d.category}  location="${d.location}"  status=${d.status}`);
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
  console.log('Tip: GET /api/noticeboard results are cached for 5 min — clear cache or wait.');
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
