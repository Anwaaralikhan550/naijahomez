#!/usr/bin/env node

const path = require('path');
const { pathToFileURL } = require('url');

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  const text = normalizeText(value).toLowerCase();
  return ['1', 'true', 'yes', 'y', 'on'].includes(text);
}

function parseArgs(argv) {
  const parsed = {
    help: false,
    source: '',
    category: '',
    limit: 50,
    concurrency: 2,
    detail: false,
    detailExplicit: false,
    listingType: '',
    save: false,
    dryRun: false,
    delayMs: 0,
    maxAgeDays: 60
  };
  const positionals = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }

    const readValue = () => {
      if (arg.includes('=')) return arg.split('=').slice(1).join('=');
      if (argv[i + 1] && !argv[i + 1].startsWith('--')) {
        i += 1;
        return argv[i];
      }
      return '';
    };

    if (arg.startsWith('--source')) {
      parsed.source = normalizeText(readValue()).toLowerCase();
      continue;
    }
    if (arg.startsWith('--category')) {
      parsed.category = normalizeText(readValue()).toLowerCase();
      continue;
    }
    if (arg.startsWith('--limit')) {
      parsed.limit = parseInt(readValue(), 10);
      continue;
    }
    if (arg.startsWith('--concurrency')) {
      parsed.concurrency = parseInt(readValue(), 10);
      continue;
    }
    if (arg.startsWith('--delay-ms')) {
      parsed.delayMs = parseInt(readValue(), 10);
      continue;
    }
    if (arg.startsWith('--max-age-days')) {
      parsed.maxAgeDays = parseInt(readValue(), 10);
      continue;
    }
    if (arg.startsWith('--listing-type') || arg.startsWith('--property-purpose')) {
      parsed.listingType = normalizeText(readValue()).toLowerCase();
      continue;
    }
    if (arg === '--detail') {
      parsed.detail = true;
      parsed.detailExplicit = true;
      continue;
    }
    if (arg.startsWith('--detail=')) {
      parsed.detail = parseBoolean(readValue());
      parsed.detailExplicit = true;
      continue;
    }
    if (arg === '--save') {
      parsed.save = true;
      continue;
    }
    if (arg.startsWith('--save=')) {
      parsed.save = parseBoolean(readValue());
      continue;
    }
    if (arg === '--dry-run') {
      parsed.dryRun = true;
      continue;
    }

    positionals.push(arg);
  }

  // npm sometimes strips unknown flags into plain values. Support both styles.
  if (!parsed.source && positionals[0]) parsed.source = normalizeText(positionals[0]).toLowerCase();
  if (!parsed.category && positionals[1]) parsed.category = normalizeText(positionals[1]).toLowerCase();
  if ((!Number.isFinite(parsed.limit) || parsed.limit === 50) && positionals[2]) {
    parsed.limit = parseInt(positionals[2], 10);
  }

  if (!Number.isFinite(parsed.limit) || parsed.limit <= 0) parsed.limit = 50;
  parsed.limit = Math.min(parsed.limit, 500);

  if (!Number.isFinite(parsed.concurrency) || parsed.concurrency <= 0) parsed.concurrency = 2;
  parsed.concurrency = Math.min(parsed.concurrency, 5);

  if (!Number.isFinite(parsed.delayMs) || parsed.delayMs < 0) parsed.delayMs = 0;
  if (!Number.isFinite(parsed.maxAgeDays) || parsed.maxAgeDays <= 0) parsed.maxAgeDays = 60;

  if (parsed.category === 'classified') parsed.category = 'noticeboard';
  if (['both', 'all', 'mixed', 'rent-and-sale', 'rent_sale'].includes(parsed.listingType)) {
    parsed.listingType = 'both';
  }
  if (!['', 'rent', 'sale', 'both'].includes(parsed.listingType)) parsed.listingType = '';
  if (!parsed.listingType && parsed.category === 'property') {
    parsed.listingType = normalizeText(process.env.DAILY_PROPERTY_LISTING_TYPE || process.env.SCRAPER_PROPERTY_LISTING_TYPE || 'both').toLowerCase();
    if (!['rent', 'sale', 'both'].includes(parsed.listingType)) parsed.listingType = 'both';
  }
  if (!parsed.detailExplicit && parsed.category === 'property') {
    const detailEnv = normalizeText(process.env.SCRAPER_DETAIL_ENRICHMENT || process.env.DAILY_SCRAPER_DETAIL).toLowerCase();
    parsed.detail = !['0', 'false', 'no', 'off'].includes(detailEnv);
  }

  return parsed;
}

function printHelp() {
  console.log('Usage: node scripts/live-scraper.js [options]');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/live-scraper.js --source jiji --category marketplace --limit 30');
  console.log('  node scripts/live-scraper.js --source nigeria-property-centre --category property --limit 20 --detail');
  console.log('  node scripts/live-scraper.js --source all --category marketplace --limit 50 --save');
  console.log('');
  console.log('Options:');
  console.log('  --source <jiji|locanto|nigeria-property-centre|all>');
  console.log('  --category <property|marketplace|phones|electronics|cars|noticeboard|housemates>');
  console.log('  --limit <n>                  Max 500');
  console.log('  --concurrency <n>            Source concurrency, max 5');
  console.log('  --detail                     Fetch detail pages for richer data');
  console.log('  --delay-ms <n>               Delay between requests');
  console.log('  --max-age-days <n>           Default 60');
  console.log('  --listing-type <rent|sale|both>  Property mode. Default both for property');
  console.log('  --save                       Save to Firestore collection');
  console.log('  --dry-run                    Scrape only, do not save');
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
  const passes = [
    {
      label: 'rent',
      listingType: 'rent',
      sources: ['nigeria-property-centre'],
      limit: rentLimit,
      fetchLimit: rentLimit + fetchBuffer
    }
  ];

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

async function loadScraperModule() {
  const modulePath = path.resolve(__dirname, '../src/lib/scrapers/index.js');
  try {
    return require(modulePath);
  } catch (error) {
    if (error.code !== 'ERR_REQUIRE_ESM' && !String(error.message || '').includes('import statement')) {
      throw error;
    }
    const imported = await import(pathToFileURL(modulePath).href);
    return imported.default || imported;
  }
}

function loadEnvIfNeeded() {
  try {
    const { loadEnvConfig } = require('@next/env');
    loadEnvConfig(path.resolve(__dirname, '..'));
  } catch {
    require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
    require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
  }
}

function getScraperWriteTarget() {
  const target = normalizeText(process.env.SCRAPER_WRITE_TARGET || 'both').toLowerCase();
  if (['postgres', 'firestore', 'both'].includes(target)) return target;
  return 'both';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const scraperModule = await loadScraperModule();
  const supportedSources = scraperModule.getSupportedSources();
  const selectedSourcesRaw = !args.source || args.source === 'all'
    ? supportedSources
    : [scraperModule.getCanonicalSource(args.source)];
  const selectedSources = selectedSourcesRaw.filter((source) =>
    !scraperModule.isSourceCategorySupported || scraperModule.isSourceCategorySupported(source, args.category)
  );

  if (!selectedSources.length) {
    throw new Error(`No supported sources for category "${args.category || 'default'}".`);
  }

  const summary = {
    success: true,
    startedAt: new Date().toISOString(),
    source: args.source || 'all',
    category: args.category || null,
    limit: args.limit,
    concurrency: args.concurrency,
    detail: args.detail,
    listingType: args.listingType || null,
    save: args.save && !args.dryRun,
    dryRun: args.dryRun,
    totals: {
      scraped: 0,
      added: 0,
      skipped: 0,
      sourcesRun: selectedSources.length,
      sourcesSucceeded: 0,
      sourcesFailed: 0
    },
    results: []
  };

  if ((args.save && !args.dryRun) && !args.category) {
    throw new Error('--category is required when using --save.');
  }

  let importService = null;
  let db = null;
  let collectionName = null;
  if (args.save && !args.dryRun) {
    loadEnvIfNeeded();
    importService = require('../src/lib/scrapers/scraper-import-service');
    collectionName = importService.resolveCollectionName(importService.normalizeCategory(args.category));
    if (!collectionName) throw new Error(`Unsupported save category "${args.category}".`);
    if (getScraperWriteTarget() !== 'postgres') {
      db = require('../src/lib/automation/admin-firestore').getAutomationFirestore();
    }
  }

  const scraperPasses = buildScraperPasses(args, selectedSources);
  const sourceRuns = [];
  for (const pass of scraperPasses) {
    const passRuns = await scraperModule.runScrapers({
      sources: pass.sources,
      category: args.category || undefined,
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
        items: Array.isArray(sourceRun.items) ? sourceRun.items.slice(0, pass.limit) : [],
        listingType: pass.listingType || null,
        passLabel: pass.label,
        requestedLimit: pass.limit,
        fetchLimit: pass.fetchLimit || pass.limit
      }))
    );
  }

  for (const sourceRun of sourceRuns) {
    const sourceResult = {
      source: sourceRun.source,
      listingType: sourceRun.listingType,
      passLabel: sourceRun.passLabel,
      success: sourceRun.success,
      scraped: Array.isArray(sourceRun.items) ? sourceRun.items.length : 0,
      added: 0,
      skipped: 0,
      sample: Array.isArray(sourceRun.items) ? sourceRun.items.slice(0, 2) : [],
      error: sourceRun.error || null
    };

    if (!sourceRun.success) {
      summary.success = false;
      summary.totals.sourcesFailed += 1;
      summary.results.push(sourceResult);
      continue;
    }

    summary.totals.sourcesSucceeded += 1;
    summary.totals.scraped += sourceResult.scraped;

    if (importService && db) {
      const result = await importService.saveScrapedItems(
        db,
        collectionName,
        sourceRun.items,
        importService.normalizeCategory(args.category),
        sourceRun.source
      );
      sourceResult.added = result.insertedCount;
      sourceResult.skipped = result.skippedCount;
      summary.totals.added += result.insertedCount;
      summary.totals.skipped += result.skippedCount;
    }

    summary.results.push(sourceResult);
  }

  summary.finishedAt = new Date().toISOString();
  console.log(JSON.stringify(summary, null, 2));

  if (!summary.success) process.exitCode = 1;
}

main().catch((error) => {
  console.log(JSON.stringify({
    success: false,
    error: error.message,
    finishedAt: new Date().toISOString()
  }, null, 2));
  process.exit(1);
});
