#!/usr/bin/env node
/**
 * One-off cleanup: permanently delete junk/test tradespeople (services) docs
 * that are surfacing on the homepage's "Top Rated Tradespeople" section.
 *
 * Targets:
 *   1. title === "asdas"           (carpentry, location "sdasd")
 *   2. title startsWith "QA_E2E_FINAL_Service_"  (electrical, Surulere, Lagos)
 *
 * Usage:
 *   node scripts/delete-junk-tradespeople.js            # dry-run, lists matches
 *   node scripts/delete-junk-tradespeople.js --apply    # actually deletes
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

async function findMatches(db) {
  const matches = new Map(); // id -> doc snapshot

  const exact = await db.collection('services')
    .where('titleLower', '==', 'asdas')
    .get();
  exact.forEach(doc => matches.set(doc.id, doc));

  // Prefix match for QA_E2E_FINAL_Service_*
  const prefix = 'qa_e2e_final_service_';
  const end = prefix.slice(0, -1) + String.fromCharCode(prefix.charCodeAt(prefix.length - 1) + 1);
  const prefixSnap = await db.collection('services')
    .where('titleLower', '>=', prefix)
    .where('titleLower', '<', end)
    .get();
  prefixSnap.forEach(doc => matches.set(doc.id, doc));

  // Defensive fallback: if titleLower isn't populated on some old docs,
  // also scan by title field directly.
  const titleExact = await db.collection('services')
    .where('title', '==', 'asdas')
    .get();
  titleExact.forEach(doc => matches.set(doc.id, doc));

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
    console.log(`    title="${d.title}"  serviceType=${d.serviceType}  location="${d.location}"  status=${d.status}`);
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
  console.log('Tip: GET /api/tradespeople results are cached for 5 min — clear cache or wait.');
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
