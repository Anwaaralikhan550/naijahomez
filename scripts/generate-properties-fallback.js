#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  createScrapedDocId,
  getPublicSlugIdPart,
  getSourceIndexKey
} = require('../src/lib/scrapers/scraper-source-index');
const { applyGeneratedDescription } = require('../src/lib/scrapers/listing-description-generator');

const projectRoot = path.resolve(__dirname, '..');
const fallbackPath = process.env.PROPERTY_FALLBACK_CACHE_PATH ||
  path.join(projectRoot, 'data', 'properties-fallback.json');

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function parseArgs(argv) {
  const parsed = {
    source: 'all',
    category: 'property',
    limit: 50,
    concurrency: 2,
    detail: true,
    listingType: '',
    delayMs: 800,
    maxAgeDays: 60
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

    if (arg.startsWith('--source')) parsed.source = normalizeText(readValue()).toLowerCase() || parsed.source;
    if (arg.startsWith('--category')) parsed.category = normalizeText(readValue()).toLowerCase() || parsed.category;
    if (arg.startsWith('--limit')) parsed.limit = Math.min(Math.max(parseInt(readValue(), 10) || parsed.limit, 1), 200);
    if (arg.startsWith('--concurrency')) parsed.concurrency = Math.min(Math.max(parseInt(readValue(), 10) || parsed.concurrency, 1), 5);
    if (arg.startsWith('--delay-ms')) parsed.delayMs = Math.max(parseInt(readValue(), 10) || parsed.delayMs, 0);
    if (arg.startsWith('--max-age-days')) parsed.maxAgeDays = Math.max(parseInt(readValue(), 10) || parsed.maxAgeDays, 1);
    if (arg.startsWith('--listing-type') || arg.startsWith('--property-purpose')) parsed.listingType = normalizeText(readValue()).toLowerCase();
    if (arg === '--detail') parsed.detail = true;
    if (arg === '--no-detail' || arg === '--detail=false') parsed.detail = false;
  }

  if (['both', 'all', 'mixed', 'rent-and-sale', 'rent_sale'].includes(parsed.listingType)) {
    parsed.listingType = 'both';
  }
  if (!['', 'rent', 'sale', 'both'].includes(parsed.listingType)) parsed.listingType = '';
  if (!parsed.listingType && parsed.category === 'property') {
    parsed.listingType = normalizeText(process.env.DAILY_PROPERTY_LISTING_TYPE || process.env.SCRAPER_PROPERTY_LISTING_TYPE || 'both').toLowerCase();
    if (!['rent', 'sale', 'both'].includes(parsed.listingType)) parsed.listingType = 'both';
  }

  return parsed;
}

function slugify(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^\w\s-]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function toJsonSafe(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (value && typeof value === 'object') {
    const next = {};
    Object.entries(value).forEach(([key, item]) => {
      next[key] = toJsonSafe(item);
    });
    return next;
  }
  return value;
}

function fallbackIdFor(item) {
  const key = item.sourceUrl || `${item.title}|${item.location}|${item.price}`;
  return crypto.createHash('sha1').update(String(key)).digest('hex').slice(0, 12);
}

function buildScraperPasses(args, selectedSources) {
  const isProperty = normalizeText(args.category).toLowerCase() === 'property';
  const hasNpc = selectedSources.includes('nigeria-property-centre');

  if (!isProperty || !hasNpc || args.listingType !== 'both') {
    return [{
      label: args.listingType || 'default',
      listingType: args.listingType || undefined,
      sources: selectedSources,
      limit: args.limit,
      fetchLimit: args.limit
    }];
  }

  const rentLimit = Math.ceil(args.limit / 2);
  const saleLimit = Math.max(0, args.limit - rentLimit);
  const fetchBuffer = Number(process.env.SCRAPER_MIXED_FETCH_BUFFER || 10);
  const otherSources = selectedSources.filter((source) => source !== 'nigeria-property-centre');
  const passes = [{
    label: 'rent',
    listingType: 'rent',
    sources: ['nigeria-property-centre'],
    limit: rentLimit,
    fetchLimit: rentLimit + fetchBuffer
  }];

  if (saleLimit > 0) {
    passes.push({
      label: 'sale',
      listingType: 'sale',
      sources: ['nigeria-property-centre'],
      limit: saleLimit,
      fetchLimit: saleLimit + fetchBuffer
    });
  }

  if (otherSources.length) {
    passes.push({
      label: 'other',
      listingType: undefined,
      sources: otherSources,
      limit: args.limit,
      fetchLimit: args.limit
    });
  }

  return passes;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const scraperModule = require('../src/lib/scrapers');
  const importService = require('../src/lib/scrapers/scraper-import-service');

  const supportedSources = scraperModule.getSupportedSources();
  const selectedSourcesRaw = !args.source || args.source === 'all'
    ? supportedSources
    : [scraperModule.getCanonicalSource(args.source)];
  const selectedSources = selectedSourcesRaw.filter((source) =>
    !scraperModule.isSourceCategorySupported || scraperModule.isSourceCategorySupported(source, args.category)
  );

  const sourceRuns = [];
  for (const pass of buildScraperPasses(args, selectedSources)) {
    const passRuns = await scraperModule.runScrapers({
      sources: pass.sources,
      category: args.category,
      limit: pass.fetchLimit || pass.limit,
      concurrency: args.concurrency,
      detail: args.detail,
      delayMs: args.delayMs,
      maxAgeDays: args.maxAgeDays,
      listingType: pass.listingType
    });
    sourceRuns.push(
      ...passRuns.map((sourceRun) => ({
        ...sourceRun,
        items: Array.isArray(sourceRun.items) ? sourceRun.items.slice(0, pass.limit) : []
      }))
    );
  }

  const seen = new Set();
  const data = [];
  const now = new Date();

  for (const sourceRun of sourceRuns) {
    if (!sourceRun.success) continue;

    for (const rawItem of sourceRun.items || []) {
      let enriched = importService.enrichItem(
        rawItem,
        importService.normalizeCategory(args.category),
        sourceRun.source,
        now
      );
      if (!enriched) continue;

      const dedupeKey = enriched.sourceUrl || `${enriched.title}|${enriched.location}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      enriched = await applyGeneratedDescription(enriched);

      const sourceKey = getSourceIndexKey({ ...enriched, dedupeKey });
      const id = sourceKey ? createScrapedDocId(sourceKey) : `fallback-${fallbackIdFor(enriched)}`;
      const slug = `${slugify(enriched.title) || 'property-listing'}-${getPublicSlugIdPart(id) || id.slice(-8)}`;
      data.push(toJsonSafe({
        ...enriched,
        id,
        slug,
        status: 'active',
        source: enriched.source || sourceRun.source,
        isFallback: true
      }));
    }
  }

  fs.mkdirSync(path.dirname(fallbackPath), { recursive: true });
  fs.writeFileSync(fallbackPath, JSON.stringify({
    success: true,
    generatedAt: new Date().toISOString(),
    source: args.source,
    category: args.category,
    count: data.length,
    data
  }, null, 2));

  console.log(JSON.stringify({
    success: true,
    fallbackPath,
    count: data.length
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    success: false,
    error: error.message
  }, null, 2));
  process.exit(1);
});
