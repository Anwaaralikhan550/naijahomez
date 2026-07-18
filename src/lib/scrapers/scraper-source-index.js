const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../../..');
const DEFAULT_INDEX_DIR = path.join(projectRoot, 'data', 'scraper-index');

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeIndexKey(value) {
  return normalizeText(value).toLowerCase();
}

function getDefaultSourceIndexPath(collectionName = 'properties') {
  const safeCollection = normalizeText(collectionName || 'properties')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'properties';

  return path.join(DEFAULT_INDEX_DIR, `${safeCollection}-source-index.json`);
}

function createEmptySourceIndex() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    items: {}
  };
}

function loadSourceIndex(indexPath) {
  const resolvedPath = indexPath || getDefaultSourceIndexPath();

  try {
    const parsed = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
    return {
      version: 1,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
      items: parsed.items && typeof parsed.items === 'object' ? parsed.items : {}
    };
  } catch (error) {
    if (error.code === 'ENOENT') return createEmptySourceIndex();
    throw new Error(`Failed to read scraper source index: ${error.message}`);
  }
}

function saveSourceIndex(index, indexPath) {
  const resolvedPath = indexPath || getDefaultSourceIndexPath();
  const nextIndex = {
    version: 1,
    ...index,
    updatedAt: new Date().toISOString(),
    items: index?.items && typeof index.items === 'object' ? index.items : {}
  };

  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  const tempPath = `${resolvedPath}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(nextIndex, null, 2));
  fs.renameSync(tempPath, resolvedPath);
}

function getSourceIndexKey(item = {}) {
  const sourceUrl = normalizeText(item.sourceUrl);
  if (sourceUrl) return normalizeIndexKey(sourceUrl);

  const dedupeKey = normalizeText(item.dedupeKey);
  if (dedupeKey) return normalizeIndexKey(dedupeKey);

  const source = normalizeText(item.source).toLowerCase();
  const title = normalizeText(item.title).toLowerCase();
  const location = normalizeText(item.location).toLowerCase();
  const postedAt = normalizeText(item.postedAt || item.createdAt);
  const fallback = [source, title, location, postedAt].filter(Boolean).join('|');
  return normalizeIndexKey(fallback);
}

function createScrapedDocId(sourceKey) {
  const hash = crypto
    .createHash('sha1')
    .update(normalizeIndexKey(sourceKey))
    .digest('hex')
    .slice(0, 20);

  return `scraped_${hash}`;
}

function getPublicSlugIdPart(docId) {
  return String(docId || '').replace(/^scraped_/, '').slice(0, 8);
}

function getSourceIndexEntry(index, sourceKey) {
  const key = normalizeIndexKey(sourceKey);
  return key ? index?.items?.[key] || null : null;
}

function hasSavedSource(index, sourceKey) {
  const entry = getSourceIndexEntry(index, sourceKey);
  return Boolean(entry?.savedAt || entry?.docId);
}

function upsertSourceIndexEntry(index, sourceKey, patch = {}) {
  const key = normalizeIndexKey(sourceKey);
  if (!key) return null;

  if (!index.items || typeof index.items !== 'object') index.items = {};

  const now = new Date().toISOString();
  const previous = index.items[key] || {};
  const next = {
    ...previous,
    ...patch,
    sourceKey: key,
    firstSeenAt: previous.firstSeenAt || patch.firstSeenAt || now,
    lastSeenAt: patch.lastSeenAt || now
  };

  index.items[key] = next;
  return next;
}

module.exports = {
  createEmptySourceIndex,
  createScrapedDocId,
  getDefaultSourceIndexPath,
  getPublicSlugIdPart,
  getSourceIndexEntry,
  getSourceIndexKey,
  hasSavedSource,
  loadSourceIndex,
  saveSourceIndex,
  upsertSourceIndexEntry
};
