#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

const sak = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (sak) {
  const sa = JSON.parse(sak);
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id });
} else {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

const db = admin.firestore();

(async () => {
  const noticeIds = ['6rjGV9olvflKXpucbsMs', 'ib434mwvOxymNsLT3GFI', '1yB7qKJxoEGla3MLL84f'];
  const tradesIds = ['x6ZpaxVcI2BePOPjwA4G', '6Y00YiTS71pEtiKKJ5JA'];

  console.log('--- noticeboard ---');
  for (const id of noticeIds) {
    const d = await db.collection('noticeboard').doc(id).get();
    console.log(`${id}  exists=${d.exists}`);
  }
  console.log('--- services ---');
  for (const id of tradesIds) {
    const d = await db.collection('services').doc(id).get();
    console.log(`${id}  exists=${d.exists}`);
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
