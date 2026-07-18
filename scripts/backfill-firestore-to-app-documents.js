#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { loadEnvConfig } = require('@next/env');
const { cert, getApps, initializeApp } = require('firebase-admin/app');
const { FieldPath, getFirestore } = require('firebase-admin/firestore');
const { closePool } = require('../src/lib/db/postgres-client.cjs');
const { upsertAppDocument } = require('../src/lib/db/postgres-document-store.cjs');

const projectRoot = path.resolve(__dirname, '..');
const DEFAULT_CHECKPOINT_FILE = path.join(projectRoot, 'data', 'firestore-app-documents-backfill-checkpoint.json');

const DEFAULT_COLLECTIONS = [
  'users',
  'emailVerificationTokens',
  'kycOtpCodes',
  'kycSubmissions',
  'listing_reports',
  'supportTickets',
  'supportEmailLogs',
  'blogPosts',
  'contentJobs',
  'marketTrends',
  'socialShareQueue',
  'socialShareLogs',
  'adCampaigns',
  'adCampaignPayments',
  'adMetricDaily',
  'adMetricShards',
  'adClickEvents',
  'journeyMetricDaily',
  'heatmapMetricDaily',
  'marketEngagementReports',
  'agentActivityReports',
  'monetizationIntents',
  'transactionLogs',
  'mail_logs',
  'messages',
  'privateConversations',
  'privateMessages',
  'hubAccessCodes',
  'hubCommunities',
  'hubMembers',
  'hubNotifications',
  'hubVisitorCodes',
  'hubIssues',
  'hubEmergencyAlerts',
  'hubAmenityBookings',
  'hubAmenities',
  'hubMarketplace',
  'hubSmartServices',
  'hubEvents',
  'hubForumDiscussions',
  'hubForumReplies',
  'hubJoinRequests',
  'hubAlerts',
  'hubMessages',
  'chatMessages',
  'socialPosts',
  'notifications',
  'surveyReports',
  'surveySignatures'
];

function parseArgs(argv) {
  const args = {
    collections: DEFAULT_COLLECTIONS,
    batchSize: 50,
    delayMs: 1000,
    limit: 0,
    maxBatches: 0,
    dryRun: false,
    resume: true,
    resetCheckpoint: false,
    checkpointFile: DEFAULT_CHECKPOINT_FILE,
    includeSupportMessages: true,
    discoverAll: false,
    recursive: false,
    skipRecursiveCollections: ['properties', 'marketplace', 'services', 'housemates', 'noticeboard']
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const readValue = () => {
      if (arg.includes('=')) return arg.split('=').slice(1).join('=');
      if (argv[i + 1] && !argv[i + 1].startsWith('--')) {
        i += 1;
        return argv[i];
      }
      return '';
    };

    if (arg.startsWith('--collection') || arg.startsWith('--collections')) {
      args.collections = readValue().split(',').map((item) => item.trim()).filter(Boolean);
      continue;
    }
    if (arg.startsWith('--batch-size')) {
      args.batchSize = Math.min(Math.max(10, parseInt(readValue(), 10) || 50), 500);
      continue;
    }
    if (arg.startsWith('--delay-ms')) {
      args.delayMs = Math.max(0, parseInt(readValue(), 10) || 0);
      continue;
    }
    if (arg.startsWith('--limit')) {
      args.limit = Math.max(0, parseInt(readValue(), 10) || 0);
      continue;
    }
    if (arg.startsWith('--max-batches')) {
      args.maxBatches = Math.max(0, parseInt(readValue(), 10) || 0);
      continue;
    }
    if (arg.startsWith('--checkpoint-file')) {
      const value = readValue();
      args.checkpointFile = path.isAbsolute(value) ? value : path.join(projectRoot, value);
      continue;
    }
    if (arg === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (arg === '--discover-all') {
      args.discoverAll = true;
      continue;
    }
    if (arg === '--recursive') {
      args.recursive = true;
      continue;
    }
    if (arg.startsWith('--skip-recursive-collections')) {
      args.skipRecursiveCollections = readValue().split(',').map((item) => item.trim()).filter(Boolean);
      continue;
    }
    if (arg === '--no-resume') {
      args.resume = false;
      continue;
    }
    if (arg === '--reset-checkpoint') {
      args.resetCheckpoint = true;
      continue;
    }
    if (arg === '--no-support-messages') {
      args.includeSupportMessages = false;
    }
  }

  return args;
}

function sleep(ms) {
  return ms ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

function serializeFirestoreData(data = {}) {
  return JSON.parse(JSON.stringify(data, (_key, value) => {
    if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
    if (value && Number.isFinite(value._seconds)) {
      return new Date(value._seconds * 1000 + Math.floor((value._nanoseconds || 0) / 1000000)).toISOString();
    }
    return value === undefined ? null : value;
  }));
}

function loadCheckpoint(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return { collections: {} };
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_error) {
    return { collections: {} };
  }
}

function saveCheckpoint(filePath, checkpoint) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify({ ...checkpoint, updatedAt: new Date().toISOString() }, null, 2));
}

function initSourceFirestore() {
  if (getApps().length > 0) return getFirestore(getApps()[0]);

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountKey) {
    const serviceAccount = JSON.parse(serviceAccountKey);
    return getFirestore(initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id
    }));
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Admin credentials are required for source backfill.');
  }

  return getFirestore(initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n')
    }),
    projectId
  }));
}

async function discoverTopLevelCollections(db) {
  const refs = await db.listCollections();
  return refs.map((ref) => ref.id).sort((a, b) => a.localeCompare(b));
}

function shouldScanSubcollections(collectionPath, options) {
  if (!options.recursive) return false;
  const rootCollection = String(collectionPath || '').split('/')[0];
  return !options.skipRecursiveCollections.includes(rootCollection);
}

async function backfillCollection(db, collectionPath, options, checkpoint) {
  let totalRead = 0;
  let totalUpserted = 0;
  let lastDoc = null;
  let batchCount = 0;
  let lastDocId = options.resume ? checkpoint.collections?.[collectionPath]?.lastDocId || '' : '';

  while (true) {
    if (options.limit > 0 && totalRead >= options.limit) break;
    if (options.maxBatches > 0 && batchCount >= options.maxBatches) break;

    const remaining = options.limit > 0 ? options.limit - totalRead : options.batchSize;
    let queryRef = db.collection(collectionPath)
      .orderBy(FieldPath.documentId())
      .limit(Math.min(options.batchSize, remaining));

    if (lastDoc) queryRef = queryRef.startAfter(lastDoc);
    else if (lastDocId) queryRef = queryRef.startAfter(lastDocId);

    const snapshot = await queryRef.get();
    if (snapshot.empty) break;

    for (const doc of snapshot.docs) {
      const data = { id: doc.id, ...serializeFirestoreData(doc.data()) };
      if (!options.dryRun) {
        await upsertAppDocument(collectionPath, doc.id, data);
      }
      totalUpserted += options.dryRun ? 0 : 1;

      if (shouldScanSubcollections(collectionPath, options)) {
        const subcollections = await doc.ref.listCollections();
        for (const subcollection of subcollections) {
          const subcollectionPath = `${doc.ref.path}/${subcollection.id}`;
          checkpoint.discoveredCollections = checkpoint.discoveredCollections || {};
          checkpoint.discoveredCollections[subcollectionPath] = true;
        }
      }
    }

    totalRead += snapshot.size;
    batchCount += 1;
    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    lastDocId = lastDoc.id;

    if (!options.dryRun) {
      checkpoint.collections = checkpoint.collections || {};
      checkpoint.collections[collectionPath] = {
        lastDocId,
        totalRead: (checkpoint.collections[collectionPath]?.totalRead || 0) + snapshot.size,
        totalUpserted: (checkpoint.collections[collectionPath]?.totalUpserted || 0) + snapshot.size,
        updatedAt: new Date().toISOString()
      };
      saveCheckpoint(options.checkpointFile, checkpoint);
    }

    console.log(`[app-doc-backfill] ${collectionPath}: read=${totalRead} upserted=${totalUpserted} lastDocId=${lastDocId}`);
    if (snapshot.size < Math.min(options.batchSize, remaining)) break;
    await sleep(options.delayMs);
  }

  return { collectionPath, totalRead, totalUpserted, lastDocId, batchCount };
}

async function backfillSupportMessages(db, options, checkpoint) {
  if (!options.includeSupportMessages) return null;
  const supportCheckpointKey = 'supportTickets/*/supportTicketMessages';
  const ticketSnap = await db.collection('supportTickets').orderBy(FieldPath.documentId()).limit(500).get();
  let totalRead = 0;
  let totalUpserted = 0;

  for (const ticketDoc of ticketSnap.docs) {
    const collectionPath = `supportTickets/${ticketDoc.id}/supportTicketMessages`;
    const messageSnap = await ticketDoc.ref.collection('supportTicketMessages').limit(500).get();
    for (const messageDoc of messageSnap.docs) {
      const data = { id: messageDoc.id, ...serializeFirestoreData(messageDoc.data()) };
      totalRead += 1;
      if (!options.dryRun) {
        await upsertAppDocument(collectionPath, messageDoc.id, data);
        totalUpserted += 1;
      }
    }
    await sleep(Math.min(options.delayMs, 500));
  }

  if (!options.dryRun) {
    checkpoint.collections = checkpoint.collections || {};
    checkpoint.collections[supportCheckpointKey] = {
      totalRead,
      totalUpserted,
      updatedAt: new Date().toISOString()
    };
    saveCheckpoint(options.checkpointFile, checkpoint);
  }

  console.log(`[app-doc-backfill] ${supportCheckpointKey}: read=${totalRead} upserted=${totalUpserted}`);
  return { collectionPath: supportCheckpointKey, totalRead, totalUpserted };
}

async function main() {
  loadEnvConfig(projectRoot);
  const args = parseArgs(process.argv.slice(2));
  if (args.resetCheckpoint && fs.existsSync(args.checkpointFile)) {
    fs.unlinkSync(args.checkpointFile);
  }

  const checkpoint = args.dryRun ? { collections: {} } : loadCheckpoint(args.checkpointFile);
  const db = initSourceFirestore();
  const results = [];
  let collections = args.collections;

  if (args.discoverAll) {
    collections = await discoverTopLevelCollections(db);
    console.log(`[app-doc-backfill] discovered top-level collections: ${collections.join(', ')}`);
  }

  const processed = new Set();
  const queue = [...collections];

  while (queue.length) {
    const collectionName = queue.shift();
    if (!collectionName || processed.has(collectionName)) continue;

    processed.add(collectionName);
    results.push(await backfillCollection(db, collectionName, args, checkpoint));

    const discovered = Object.keys(checkpoint.discoveredCollections || {}).sort();
    for (const path of discovered) {
      if (!processed.has(path) && !queue.includes(path)) queue.push(path);
    }
  }

  const supportMessages = await backfillSupportMessages(db, args, checkpoint);
  if (supportMessages) results.push(supportMessages);

  console.log(JSON.stringify({
    success: true,
    dryRun: args.dryRun,
    checkpointFile: args.dryRun ? null : args.checkpointFile,
    results
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    success: false,
    error: error.message
  }, null, 2));
  process.exitCode = 1;
}).finally(async () => {
  await closePool().catch(() => {});
});
