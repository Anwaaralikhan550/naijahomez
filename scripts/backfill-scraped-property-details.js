#!/usr/bin/env node

const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

const { fetchHtmlWithRetry, normalizeText } = require('../src/lib/scrapers/scraper-utils');
const { parseDetailPage } = require('../src/lib/scrapers/nigeria-property-centre.scraper');
const { applyGeneratedDescription } = require('../src/lib/scrapers/listing-description-generator');

function parseArgs(argv) {
  const parsed = {
    limit: 50,
    createdFrom: '',
    createdTo: '',
    dryRun: false,
    regenerateDescription: true,
    delayMs: 800
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
    if (arg.startsWith('--created-from')) parsed.createdFrom = normalizeText(readValue());
    if (arg.startsWith('--created-to')) parsed.createdTo = normalizeText(readValue());
    if (arg.startsWith('--delay-ms')) parsed.delayMs = Math.max(parseInt(readValue(), 10) || parsed.delayMs, 0);
    if (arg === '--dry-run') parsed.dryRun = true;
    if (arg === '--no-description') parsed.regenerateDescription = false;
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

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toIso(value) {
  const date = toDate(value);
  return date ? date.toISOString() : '';
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

function pickNumber(value, fallback) {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return fallback;
}

function cleanImageList(value) {
  return Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .map((item) => normalizeText(item))
        .filter(Boolean)
    )
  );
}

function pickBackfilledImages(existing, detail) {
  const existingImages = cleanImageList(existing.imageUrls);
  const detailImages = cleanImageList(detail.imageUrls);

  if (detailImages.length > existingImages.length) {
    return detailImages;
  }

  return existingImages;
}

function buildDetailUpdate(existing, detail) {
  const imageUrls = pickBackfilledImages(existing, detail);
  return {
    bedrooms: pickNumber(detail.bedrooms, existing.bedrooms || null),
    bathrooms: pickNumber(detail.bathrooms, existing.bathrooms || null),
    toilets: pickNumber(detail.toilets, existing.toilets || null),
    parkingSpaces: pickNumber(detail.parkingSpaces, existing.parkingSpaces || null),
    squareMeters: pickNumber(detail.squareMeters, existing.squareMeters || existing.size || null),
    size: pickNumber(detail.squareMeters, existing.squareMeters || existing.size || null),
    sizeUnit: detail.sizeUnit || existing.sizeUnit || null,
    imageUrls,
    sourceMetadata: {
      ...(existing.sourceMetadata || {}),
      detailBackfilledAt: new Date().toISOString(),
      detailBackfillSource: 'npc_structured_property_values',
      imageBackfilledAt: imageUrls.length > cleanImageList(existing.imageUrls).length
        ? new Date().toISOString()
        : existing.sourceMetadata?.imageBackfilledAt || null,
      imageBackfillCount: imageUrls.length
    }
  };
}

function cleanUpdateData(data) {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  loadEnvIfNeeded();

  const { getAutomationFirestore } = require('../src/lib/automation/admin-firestore');
  const db = getAutomationFirestore();
  const snapshot = await db.collection('properties')
    .where('isScraped', '==', true)
    .limit(args.limit)
    .get();

  const candidates = snapshot.docs
    .map((doc) => ({ id: doc.id, ref: doc.ref, data: doc.data() || {} }))
    .filter(({ data }) => data.sourceUrl && isInsideCreatedWindow(data, args));

  const results = [];
  let updated = 0;

  for (const candidate of candidates) {
    try {
      const html = await fetchHtmlWithRetry(candidate.data.sourceUrl, {
        delayMs: args.delayMs,
        referer: 'https://nigeriapropertycentre.com',
        retries: 1
      });
      const detail = parseDetailPage(html, candidate.data.sourceUrl);
      const detailUpdate = buildDetailUpdate(candidate.data, detail);
      let updateData = cleanUpdateData({
        ...detailUpdate,
        updatedAt: new Date()
      });

      if (args.regenerateDescription) {
        const generated = await applyGeneratedDescription({
          id: candidate.id,
          ...candidate.data,
          ...detailUpdate
        });
        updateData = {
          ...updateData,
          description: generated.description,
          generatedDescription: generated.generatedDescription || generated.description,
          descriptionGeneratedBy: generated.descriptionGeneratedBy,
          descriptionGenerationMode: generated.descriptionGenerationMode,
          descriptionGeneratedAt: new Date(),
          descriptionGenerationError: generated.descriptionGenerationError || null,
          sourceMetadata: {
            ...(updateData.sourceMetadata || {}),
            ...(generated.sourceMetadata || {})
          }
        };
      }

      if (!args.dryRun) {
        await candidate.ref.set(updateData, { merge: true });
      }
      updated += 1;

      results.push({
        id: candidate.id,
        title: candidate.data.title || '',
        createdAt: toIso(candidate.data.createdAt),
        bedrooms: updateData.bedrooms || null,
        bathrooms: updateData.bathrooms || null,
        toilets: updateData.toilets || null,
        squareMeters: updateData.squareMeters || null,
        imageCount: Array.isArray(updateData.imageUrls) ? updateData.imageUrls.length : 0,
        descriptionGeneratedBy: updateData.descriptionGeneratedBy || candidate.data.descriptionGeneratedBy || null
      });
    } catch (error) {
      results.push({
        id: candidate.id,
        title: candidate.data.title || '',
        error: normalizeText(error.message).slice(0, 240)
      });
    }
  }

  const summary = results.reduce((acc, item) => {
    if (item.error) acc.errors += 1;
    if (item.bedrooms) acc.withBedrooms += 1;
    if (item.bathrooms) acc.withBathrooms += 1;
    if (item.toilets) acc.withToilets += 1;
    if (item.squareMeters) acc.withSize += 1;
    if (item.imageCount > 1) acc.withMultipleImages += 1;
    return acc;
  }, {
    total: results.length,
    withBedrooms: 0,
    withBathrooms: 0,
    withToilets: 0,
    withSize: 0,
    withMultipleImages: 0,
    errors: 0
  });

  console.log(JSON.stringify({
    success: true,
    dryRun: args.dryRun,
    fetched: snapshot.size,
    candidates: candidates.length,
    updated: args.dryRun ? 0 : updated,
    summary,
    results
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    success: false,
    error: error.message
  }, null, 2));
  process.exit(1);
});
