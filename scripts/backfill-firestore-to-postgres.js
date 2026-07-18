#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const { loadEnvConfig } = require('@next/env');
const { FieldPath } = require('firebase-admin/firestore');
const { getAutomationFirestore } = require('../src/lib/automation/admin-firestore');
const { closePool } = require('../src/lib/db/postgres-client.cjs');
const { upsertPublicListings } = require('../src/lib/db/listing-repository.cjs');

const projectRoot = path.resolve(__dirname, '..');
const DEFAULT_COLLECTIONS = ['properties', 'marketplace', 'services', 'housemates', 'noticeboard'];
const DEFAULT_CHECKPOINT_FILE = path.join(projectRoot, 'data', 'firestore-postgres-backfill-checkpoint.json');

function parseArgs(argv) {
  const args = {
    collections: DEFAULT_COLLECTIONS,
    limit: 0,
    batchSize: 50,
    delayMs: 1000,
    maxBatches: 0,
    checkpointFile: DEFAULT_CHECKPOINT_FILE,
    dryRun: false,
    resume: true,
    resetCheckpoint: false
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
      args.collections = readValue()
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      continue;
    }
    if (arg.startsWith('--limit')) {
      args.limit = Math.max(0, parseInt(readValue(), 10) || 0);
      continue;
    }
    if (arg.startsWith('--batch-size')) {
      args.batchSize = Math.min(Math.max(25, parseInt(readValue(), 10) || 250), 500);
      continue;
    }
    if (arg.startsWith('--delay-ms')) {
      args.delayMs = Math.max(0, parseInt(readValue(), 10) || 0);
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
    if (arg === '--no-resume') {
      args.resume = false;
      continue;
    }
    if (arg === '--reset-checkpoint') {
      args.resetCheckpoint = true;
    }
  }

  return args;
}

function sleep(ms) {
  if (!ms) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadCheckpoint(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_error) {
    return {};
  }
}

function saveCheckpoint(filePath, checkpoint) {
  if (!filePath) return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify({
    ...checkpoint,
    updatedAt: new Date().toISOString()
  }, null, 2));
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

async function backfillCollection(db, collectionName, options, checkpoint) {
  let totalRead = 0;
  let totalUpserted = 0;
  let lastDoc = null;
  let batchCount = 0;
  let lastDocId = options.resume ? checkpoint?.collections?.[collectionName]?.lastDocId || '' : '';

  while (true) {
    const remaining = options.limit > 0 ? options.limit - totalRead : options.batchSize;
    if (options.limit > 0 && remaining <= 0) break;
    if (options.maxBatches > 0 && batchCount >= options.maxBatches) break;

    let queryRef = db.collection(collectionName)
      .orderBy(FieldPath.documentId())
      .limit(Math.min(options.batchSize, remaining));

    if (lastDoc) queryRef = queryRef.startAfter(lastDoc);
    else if (lastDocId) queryRef = queryRef.startAfter(lastDocId);

    const snapshot = await queryRef.get();
    if (snapshot.empty) break;

    const items = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...serializeFirestoreData(doc.data())
    }));

    totalRead += items.length;
    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    lastDocId = lastDoc.id;
    batchCount += 1;

    if (!options.dryRun) {
      const result = await upsertPublicListings(collectionName, items);
      totalUpserted += result.upserted || 0;

      checkpoint.collections = checkpoint.collections || {};
      checkpoint.collections[collectionName] = {
        lastDocId,
        totalRead: (checkpoint.collections[collectionName]?.totalRead || 0) + items.length,
        totalUpserted: (checkpoint.collections[collectionName]?.totalUpserted || 0) + (result.upserted || 0),
        updatedAt: new Date().toISOString()
      };
      saveCheckpoint(options.checkpointFile, checkpoint);
    }

    console.log(`[backfill] ${collectionName}: read=${totalRead} upserted=${totalUpserted} lastDocId=${lastDocId}`);

    if (snapshot.size < Math.min(options.batchSize, remaining)) break;
    await sleep(options.delayMs);
  }

  return { collectionName, totalRead, totalUpserted, lastDocId, batchCount };
}

async function main() {
  loadEnvConfig(projectRoot);

  const args = parseArgs(process.argv.slice(2));
  if (args.resetCheckpoint && args.checkpointFile && fs.existsSync(args.checkpointFile)) {
    fs.unlinkSync(args.checkpointFile);
  }

  const checkpoint = args.dryRun ? {} : loadCheckpoint(args.checkpointFile);
  const db = getAutomationFirestore();
  const results = [];

  for (const collectionName of args.collections) {
    results.push(await backfillCollection(db, collectionName, args, checkpoint));
  }

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
