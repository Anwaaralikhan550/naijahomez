const SCRAPER_LOADERS = {
  'nigeria-property-centre': () => require('./nigeria-property-centre.scraper'),
  jiji: () => require('./jiji.scraper'),
  locanto: () => require('./locanto.scraper')
};

const SOURCE_ALIASES = {
  npc: 'nigeria-property-centre',
  nigeriapropertycentre: 'nigeria-property-centre'
};

const SCRAPER_EXPORTS = {
  'nigeria-property-centre': 'scrapeNigeriaPropertyCentre',
  jiji: 'scrapeJiji',
  locanto: 'scrapeLocanto'
};

const SOURCE_CATEGORY_SUPPORT = {
  'nigeria-property-centre': new Set(['property', 'housemates', 'shared-housing', 'shared-housing-roommates']),
  jiji: new Set(['marketplace', 'phones', 'electronics', 'cars', 'noticeboard', 'classified']),
  locanto: new Set(['marketplace', 'phones', 'electronics', 'cars', 'noticeboard', 'classified'])
};

const loadedScrapers = new Map();

function normalizeSource(source) {
  return String(source || '').trim().toLowerCase();
}

function getCanonicalSource(source) {
  const normalized = normalizeSource(source);
  return SOURCE_ALIASES[normalized] || normalized;
}

function getSupportedSources() {
  return ['nigeria-property-centre', 'jiji', 'locanto'];
}

function normalizeCategory(category) {
  const normalized = String(category || '').trim().toLowerCase();
  if (normalized === 'classified') return 'noticeboard';
  if (normalized === 'shared') return 'shared-housing';
  if (normalized === 'flatmates') return 'housemates';
  if (normalized === 'mobile-phones' || normalized === 'phone') return 'phones';
  return normalized;
}

function isSourceCategorySupported(source, category) {
  const canonicalSource = getCanonicalSource(source);
  const normalizedCategory = normalizeCategory(category);
  if (!normalizedCategory) return true;
  const supported = SOURCE_CATEGORY_SUPPORT[canonicalSource];
  return Boolean(supported?.has(normalizedCategory));
}

function parseConcurrencyLimit(value, fallback = 2) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(parsed, 5);
}

function resolveScraper(source) {
  const canonicalSource = getCanonicalSource(source);
  const cached = loadedScrapers.get(canonicalSource);
  if (cached) {
    return cached;
  }

  const loader = SCRAPER_LOADERS[canonicalSource];
  if (!loader) {
    return null;
  }

  const moduleValue = loader() || {};
  const exportName = SCRAPER_EXPORTS[canonicalSource];
  const scraper =
    moduleValue[exportName] ||
    moduleValue.default?.[exportName] ||
    moduleValue.default ||
    null;

  if (typeof scraper === 'function') {
    loadedScrapers.set(canonicalSource, scraper);
    return scraper;
  }

  return null;
}

async function runScraper(options = {}) {
  const source = getCanonicalSource(options.source);
  const scraper = resolveScraper(source);
  if (!scraper) {
    throw new Error(`Unsupported source "${options.source}". Supported: ${getSupportedSources().join(', ')}`);
  }
  if (!isSourceCategorySupported(source, options.category)) {
    throw new Error(`Source "${source}" does not support category "${options.category}".`);
  }

  const items = await scraper({ ...options, source });
  return Array.isArray(items) ? items : [];
}

async function runScrapers(options = {}) {
  const { sources, concurrency = 2 } = options;
  const sourceList = (Array.isArray(sources) ? sources : [])
    .map((source) => getCanonicalSource(source))
    .filter(Boolean)
    .filter((source) => isSourceCategorySupported(source, options.category));
  const uniqueSources = Array.from(new Set(sourceList));
  const maxConcurrency = parseConcurrencyLimit(concurrency, 2);

  const results = [];
  for (let i = 0; i < uniqueSources.length; i += maxConcurrency) {
    const chunk = uniqueSources.slice(i, i + maxConcurrency);
    const chunkResults = await Promise.all(
      chunk.map(async (source) => {
        try {
          const items = await runScraper({ ...options, source });
          return { source, success: true, items, error: null };
        } catch (error) {
          return { source, success: false, items: [], error: error?.message || 'Unknown error' };
        }
      })
    );
    results.push(...chunkResults);
  }

  return results;
}

async function scrapeNigeriaPropertyCentre(options = {}) {
  return runScraper({ ...options, source: 'nigeria-property-centre' });
}

async function scrapeJiji(options = {}) {
  return runScraper({ ...options, source: 'jiji' });
}

async function scrapeLocanto(options = {}) {
  return runScraper({ ...options, source: 'locanto' });
}

const SCRAPER_REGISTRY = {
  'nigeria-property-centre': scrapeNigeriaPropertyCentre,
  npc: scrapeNigeriaPropertyCentre,
  nigeriapropertycentre: scrapeNigeriaPropertyCentre,
  jiji: scrapeJiji,
  locanto: scrapeLocanto
};

module.exports = {
  scrapeNigeriaPropertyCentre,
  scrapeJiji,
  scrapeLocanto,
  SCRAPER_REGISTRY,
  getCanonicalSource,
  getSupportedSources,
  isSourceCategorySupported,
  runScrapers,
  resolveScraper,
  runScraper,
  parseConcurrencyLimit
};
