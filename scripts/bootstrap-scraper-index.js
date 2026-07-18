#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const {
  getDefaultSourceIndexPath,
  getSourceIndexKey,
  loadSourceIndex,
  saveSourceIndex,
  upsertSourceIndexEntry
} = require('../src/lib/scrapers/scraper-source-index');

const projectRoot = path.resolve(__dirname, '..');

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function parseArgs(argv) {
  const parsed = {
    collection: 'properties',
    limit: 5000,
    fromFallback: false,
    fallbackPath: path.join(projectRoot, 'data', 'properties-fallback.json'),
    markSaved: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const readValue = () => {
      if (arg.includes('=')) return arg.split('=').slice(1).join('=');
      if (argv[index + 1] && !argv[index + 1].startsWith('--')) {
        index += 1;
        return argv[index];
      }
      return '';
    };

    if (arg.startsWith('--collection')) parsed.collection = normalizeText(readValue()) || parsed.collection;
    if (arg.startsWith('--limit')) parsed.limit = Math.min(Math.max(parseInt(readValue(), 10) || parsed.limit, 1), 20000);
    if (arg === '--from-fallback') parsed.fromFallback = true;
    if (arg.startsWith('--fallback-path')) parsed.fallbackPath = path.resolve(projectRoot, readValue());
    if (arg === '--mark-saved') parsed.markSaved = true;
  }

  return parsed;
}

function loadEnvIfNeeded() {
  try {
    const { loadEnvConfig } = require('@next/env');
    loadEnvConfig(projectRoot);
  } catch {
    require('dotenv').config({ path: path.join(projectRoot, '.env.local') });
    require('dotenv').config({ path: path.join(projectRoot, '.env') });
  }
}

function toDateIso(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function recordItem(sourceIndex, collectionName, id, item, markSaved = true, bootstrapSource = 'firestore') {
  const sourceKey = getSourceIndexKey(item);
  if (!sourceKey) return false;

  upsertSourceIndexEntry(sourceIndex, sourceKey, {
    docId: id || item.id || '',
    slug: item.slug || '',
    sourceUrl: item.sourceUrl || '',
    dedupeKey: item.dedupeKey || '',
    title: item.title || '',
    location: item.location || '',
    imageCount: Array.isArray(item.imageUrls) ? item.imageUrls.length : 0,
    savedAt: markSaved ? toDateIso(item.createdAt) || new Date().toISOString() : '',
    collectionName,
    source: item.source || item.sourceMetadata?.sourceName || '',
    bootstrapSource,
    bootstrappedAt: new Date().toISOString()
  });

  return true;
}

async function bootstrapFromFallback(args, sourceIndex) {
  const payload = JSON.parse(fs.readFileSync(args.fallbackPath, 'utf8'));
  const items = Array.isArray(payload.data) ? payload.data : [];
  let count = 0;

  items.forEach((item) => {
    if (recordItem(sourceIndex, args.collection, item.id, item, args.markSaved, 'fallback_cache')) count += 1;
  });

  return count;
}

async function bootstrapFromFirestore(args, sourceIndex) {
  loadEnvIfNeeded();
  const { getAutomationFirestore } = require('../src/lib/automation/admin-firestore');
  const db = getAutomationFirestore();
  const snapshot = await db.collection(args.collection)
    .where('isScraped', '==', true)
    .limit(args.limit)
    .get();

  let count = 0;
  snapshot.forEach((doc) => {
    if (recordItem(sourceIndex, args.collection, doc.id, doc.data(), true, 'firestore')) count += 1;
  });

  return count;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const indexPath = getDefaultSourceIndexPath(args.collection);
  const sourceIndex = loadSourceIndex(indexPath);

  const count = args.fromFallback
    ? await bootstrapFromFallback(args, sourceIndex)
    : await bootstrapFromFirestore(args, sourceIndex);

  saveSourceIndex(sourceIndex, indexPath);

  console.log(JSON.stringify({
    success: true,
    collection: args.collection,
    indexPath,
    indexed: count,
    source: args.fromFallback ? 'fallback_cache' : 'firestore',
    markSaved: args.fromFallback ? args.markSaved : true
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    success: false,
    error: error.message
  }, null, 2));
  process.exit(1);
});
