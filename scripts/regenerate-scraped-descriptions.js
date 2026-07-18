#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

const { applyGeneratedDescription } = require('../src/lib/scrapers/listing-description-generator');

const projectRoot = path.resolve(__dirname, '..');

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function parseArgs(argv) {
  const parsed = {
    limit: 50,
    sinceDays: 3,
    dryRun: false,
    skipFirestore: false,
    fromFirestore: false,
    createdFrom: '',
    createdTo: '',
    fallbackPath: process.env.PROPERTY_FALLBACK_CACHE_PATH || path.join(projectRoot, 'data', 'properties-fallback.json')
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

    if (arg.startsWith('--limit')) parsed.limit = Math.min(Math.max(parseInt(readValue(), 10) || parsed.limit, 1), 500);
    if (arg.startsWith('--since-days')) parsed.sinceDays = Math.max(parseInt(readValue(), 10) || parsed.sinceDays, 1);
    if (arg.startsWith('--fallback-path')) parsed.fallbackPath = path.resolve(projectRoot, readValue());
    if (arg === '--dry-run') parsed.dryRun = true;
    if (arg === '--skip-firestore' || arg === '--fallback-only') parsed.skipFirestore = true;
    if (arg === '--from-firestore') parsed.fromFirestore = true;
    if (arg.startsWith('--created-from')) parsed.createdFrom = normalizeText(readValue());
    if (arg.startsWith('--created-to')) parsed.createdTo = normalizeText(readValue());
  }

  return parsed;
}

async function regenerateDirectFromFirestore(args) {
  loadEnvIfNeeded();
  const { getAutomationFirestore } = require('../src/lib/automation/admin-firestore');
  const db = getAutomationFirestore();
  const snapshot = await db.collection('properties')
    .where('isScraped', '==', true)
    .limit(args.limit)
    .get();

  const candidates = snapshot.docs
    .map((doc) => ({ id: doc.id, ref: doc.ref, data: doc.data() || {} }))
    .filter(({ data }) => shouldProcessItem(data, args));

  let updated = 0;
  const errors = [];
  const samples = [];
  const providerCounts = {};

  for (const candidate of candidates) {
    try {
      const generated = await applyGeneratedDescription({ id: candidate.id, ...candidate.data });
      providerCounts[generated.descriptionGeneratedBy || 'unknown'] =
        (providerCounts[generated.descriptionGeneratedBy || 'unknown'] || 0) + 1;

      if (!args.dryRun) {
        await candidate.ref.set({
          description: generated.description,
          generatedDescription: generated.generatedDescription || generated.description,
          descriptionGeneratedBy: generated.descriptionGeneratedBy,
          descriptionGenerationMode: generated.descriptionGenerationMode,
          descriptionGeneratedAt: new Date(),
          descriptionGenerationError: generated.descriptionGenerationError || null,
          updatedAt: new Date(),
          sourceMetadata: {
            ...(generated.sourceMetadata || {}),
            originalDescriptionPubliclyHidden: true,
            descriptionPolicy: 'facts_only_original_summary'
          }
        }, { merge: true });
      }

      updated += 1;
      if (samples.length < 3) {
        samples.push({
          id: candidate.id,
          title: candidate.data.title || '',
          descriptionGeneratedBy: generated.descriptionGeneratedBy,
          description: generated.description
        });
      }
    } catch (error) {
      errors.push({
        id: candidate.id,
        reason: normalizeText(error.message).slice(0, 220)
      });
    }
  }

  return {
    success: true,
    mode: 'from_firestore',
    dryRun: args.dryRun,
    fetched: snapshot.size,
    candidates: candidates.length,
    updated: args.dryRun ? 0 : updated,
    providerCounts,
    sample: samples,
    errors
  };
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

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isRecentEnough(item, sinceDays) {
  const date = toDate(item.createdAt || item.updatedAt || item.postedAt);
  if (!date) return true;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - sinceDays);
  return date >= cutoff;
}

function isInsideCreatedWindow(item, args) {
  const createdAt = toDate(item.createdAt);
  if (!createdAt) return !(args.createdFrom || args.createdTo);

  if (args.createdFrom) {
    const from = new Date(args.createdFrom);
    if (!Number.isNaN(from.getTime()) && createdAt < from) return false;
  }

  if (args.createdTo) {
    const to = new Date(args.createdTo);
    if (!Number.isNaN(to.getTime()) && createdAt > to) return false;
  }

  return true;
}

function shouldProcessItem(item, args) {
  if (!(item?.isScraped === true || item?.isScrapedData === true || item?.dataSource === 'scraped' || item?.sourceUrl)) {
    return false;
  }
  if (!isInsideCreatedWindow(item, args)) return false;
  return isRecentEnough(item, args.sinceDays);
}

function readFallbackPayload(fallbackPath) {
  const raw = fs.readFileSync(fallbackPath, 'utf8');
  const payload = JSON.parse(raw);
  return {
    ...payload,
    data: Array.isArray(payload.data) ? payload.data : []
  };
}

function writeFallbackPayload(fallbackPath, payload) {
  fs.mkdirSync(path.dirname(fallbackPath), { recursive: true });
  const tempPath = `${fallbackPath}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2));
  fs.renameSync(tempPath, fallbackPath);
}

async function updateFirestoreItem(db, item, generated) {
  if (!item.sourceUrl) {
    return { updated: false, reason: 'missing_source_url' };
  }

  const snapshot = await db.collection('properties')
    .where('sourceUrl', '==', item.sourceUrl)
    .limit(3)
    .get();

  if (snapshot.empty) {
    return { updated: false, reason: 'not_found_by_source_url' };
  }

  const updateData = {
    description: generated.description,
    generatedDescription: generated.generatedDescription || generated.description,
    descriptionGeneratedBy: generated.descriptionGeneratedBy,
    descriptionGenerationMode: generated.descriptionGenerationMode,
    descriptionGeneratedAt: new Date(),
    descriptionGenerationError: generated.descriptionGenerationError || null,
    updatedAt: new Date(),
    sourceMetadata: {
      ...(generated.sourceMetadata || {}),
      originalDescriptionPubliclyHidden: true,
      descriptionPolicy: 'facts_only_original_summary'
    }
  };

  await Promise.all(snapshot.docs.map((doc) => doc.ref.set(updateData, { merge: true })));
  return { updated: true, count: snapshot.size };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  loadEnvIfNeeded();

  if (args.fromFirestore) {
    console.log(JSON.stringify(await regenerateDirectFromFirestore(args), null, 2));
    return;
  }

  const payload = readFallbackPayload(args.fallbackPath);
  const candidates = payload.data
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => shouldProcessItem(item, args))
    .slice(0, args.limit);

  const generatedItems = [];

  for (const candidate of candidates) {
    const generated = await applyGeneratedDescription(candidate.item);
    payload.data[candidate.index] = {
      ...candidate.item,
      ...generated
    };
    generatedItems.push(payload.data[candidate.index]);
  }

  payload.generatedAt = new Date().toISOString();
  payload.descriptionRegeneratedAt = new Date().toISOString();
  payload.descriptionGenerationPolicy = 'facts_only_original_summary';

  if (!args.dryRun) {
    writeFallbackPayload(args.fallbackPath, payload);
  }

  const firestore = {
    attempted: false,
    updated: 0,
    skipped: 0,
    errors: []
  };

  if (!args.skipFirestore && generatedItems.length > 0) {
    firestore.attempted = true;
    try {
      const { getAutomationFirestore } = require('../src/lib/automation/admin-firestore');
      const db = getAutomationFirestore();
      for (const item of generatedItems) {
        try {
          if (args.dryRun) {
            firestore.skipped += 1;
            continue;
          }
          const result = await updateFirestoreItem(db, item, item);
          if (result.updated) {
            firestore.updated += result.count || 1;
          } else {
            firestore.skipped += 1;
            firestore.errors.push({ sourceUrl: item.sourceUrl || '', reason: result.reason });
          }
        } catch (error) {
          firestore.errors.push({
            sourceUrl: item.sourceUrl || '',
            reason: normalizeText(error.message).slice(0, 220)
          });
        }
      }
    } catch (error) {
      firestore.errors.push({ reason: normalizeText(error.message).slice(0, 220) });
    }
  }

  const providerCounts = generatedItems.reduce((acc, item) => {
    const key = item.descriptionGeneratedBy || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  console.log(JSON.stringify({
    success: true,
    dryRun: args.dryRun,
    fallbackPath: args.fallbackPath,
    candidates: candidates.length,
    fallbackUpdated: args.dryRun ? 0 : generatedItems.length,
    providerCounts,
    sample: generatedItems.slice(0, 2).map((item) => ({
      title: item.title,
      descriptionGeneratedBy: item.descriptionGeneratedBy,
      description: item.description
    })),
    firestore
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    success: false,
    error: error.message
  }, null, 2));
  process.exit(1);
});
