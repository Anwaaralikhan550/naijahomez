const {
  collectImageUrls,
  extractPhoneNumbers,
  fetchHtmlWithRetry,
  firstAttr,
  firstText,
  isUsablePrice,
  loadCheerio,
  mapLimit,
  normalizeImageUrls,
  normalizeText,
  parsePriceNumeric,
  resolvePostedAt,
  stripHtml,
  toAbsoluteUrl
} = require('./scraper-utils');

const SOURCE_NAME = 'jiji';
const SOURCE_TAG = 'Jiji';
const BASE_URL = 'https://jiji.ng';
const MAX_AGE_DAYS = 60;

const CATEGORY_URLS = {
  marketplace: `${BASE_URL}/all`,
  phones: `${BASE_URL}/mobile-phones-tablets`,
  electronics: `${BASE_URL}/electronics`,
  cars: `${BASE_URL}/cars`,
  noticeboard: `${BASE_URL}/services`,
  classified: `${BASE_URL}/services`
};

const CATEGORY_ALIASES = {
  classified: 'noticeboard',
  phone: 'phones',
  mobiles: 'phones',
  'mobile-phones': 'phones',
  'mobile-phones-tablets': 'phones',
  gadgets: 'electronics',
  vehicle: 'cars',
  vehicles: 'cars',
  autos: 'cars',
  automobile: 'cars'
};

function normalizeCategory(value) {
  const normalized = normalizeText(value || 'marketplace').toLowerCase();
  return CATEGORY_ALIASES[normalized] || normalized || 'marketplace';
}

function inferMarketplaceCategory(title, description, requestedCategory) {
  const category = normalizeCategory(requestedCategory);
  if (['phones', 'electronics', 'cars'].includes(category)) return category;
  if (category !== 'marketplace') return category;

  const haystack = `${normalizeText(title)} ${normalizeText(description)}`.toLowerCase();
  if (/\b(phone|iphone|samsung|tecno|infinix|xiaomi|android|tablet)\b/.test(haystack)) return 'phones';
  if (/\b(tv|television|laptop|computer|fridge|refrigerator|generator|speaker|console|camera|electronics)\b/.test(haystack)) return 'electronics';
  if (/\b(car|vehicle|toyota|honda|lexus|mercedes|benz|ford|nissan|hyundai)\b/.test(haystack)) return 'cars';
  return 'marketplace';
}

function parseDetailPage(html, sourceUrl) {
  const cheerio = loadCheerio();
  const $ = cheerio.load(html);
  const bodyText = normalizeText($('body').text());
  const metaDescription = normalizeText($('meta[name="description"]').attr('content'));
  const title = normalizeText($('h1').first().text() || $('title').first().text());
  const description = stripHtml(
    firstText($, $.root(), [
      '[class*="description"]',
      '[data-testid*="description"]',
      '.qa-advert-description',
      'section p'
    ]) || metaDescription
  );
  const price = firstText($, $.root(), [
    '[class*="price"]',
    '[data-testid*="price"]',
    '.qa-advert-price'
  ]);
  const location = firstText($, $.root(), [
    '[class*="location"]',
    '[class*="region"]',
    '[data-testid*="location"]'
  ]);
  const agentName = firstText($, $.root(), [
    '[class*="seller"] [class*="name"]',
    '[class*="user"] [class*="name"]',
    '[data-testid*="seller"]'
  ]);
  const phoneNumbers = extractPhoneNumbers(bodyText);
  const imageUrls = collectImageUrls($, $.root(), sourceUrl);

  return {
    title,
    description,
    price,
    location,
    agentName,
    phoneNumbers,
    imageUrls
  };
}

async function maybeEnrichDetails(items, options = {}) {
  const shouldFetchDetails = Boolean(options.detail || options.fetchDetails || process.env.SCRAPER_DETAIL_ENRICHMENT === 'true');
  if (!shouldFetchDetails) return items;

  const concurrency = Math.max(1, Math.min(Number(options.detailConcurrency || 2), 4));
  return mapLimit(items, concurrency, async (item) => {
    if (!item?.sourceUrl) return item;

    try {
      const html = await fetchHtmlWithRetry(item.sourceUrl, {
        delayMs: Number(options.detailDelayMs || options.delayMs || 500),
        referer: BASE_URL,
        retries: 1
      });
      const detail = parseDetailPage(html, item.sourceUrl);
      const phoneNumbers = detail.phoneNumbers?.length ? detail.phoneNumbers : item.phoneNumbers || [];
      return {
        ...item,
        title: detail.title || item.title,
        description: detail.description || item.description,
        price: detail.price || item.price,
        priceNumeric: parsePriceNumeric(detail.price || item.price),
        location: detail.location || item.location,
        imageUrls: detail.imageUrls?.length ? detail.imageUrls : item.imageUrls,
        agentName: detail.agentName || item.agentName,
        phoneNumbers,
        phoneNumber: phoneNumbers[0] || item.phoneNumber,
        whatsappNumber: phoneNumbers[0] || item.whatsappNumber,
        contactPhone: phoneNumbers[0] || item.contactPhone,
        sourceMetadata: {
          ...(item.sourceMetadata || {}),
          detailFetched: true
        }
      };
    } catch (error) {
      return {
        ...item,
        sourceMetadata: {
          ...(item.sourceMetadata || {}),
          detailFetched: false,
          detailError: error.message
        }
      };
    }
  });
}

async function scrapeJiji(options = {}) {
  const category = normalizeCategory(options.category || 'marketplace');
  const limit = Math.max(1, Math.min(parseInt(options.limit, 10) || 50, 500));
  const targetUrl = normalizeText(options.url) || CATEGORY_URLS[category] || CATEGORY_URLS.marketplace;
  const maxAgeDays = Number(options.maxAgeDays || MAX_AGE_DAYS);
  const nowIso = new Date().toISOString();

  const cheerio = loadCheerio();
  const html = await fetchHtmlWithRetry(targetUrl, {
    delayMs: Number(options.delayMs || 0),
    retries: Number(options.retries ?? 2),
    referer: BASE_URL
  });

  const $ = cheerio.load(html);
  const cards = $('[class*="b-list-advert"], [class*="qa-advert-list-item"], [data-testid*="adverts-list-item"], article, .masonry-item');
  const results = [];

  cards.each((_, card) => {
    if (results.length >= limit) return false;

    const sourceUrl = toAbsoluteUrl(firstAttr($, card, ['a[href]'], 'href'), BASE_URL);
    const linkTitle = normalizeText(firstAttr($, card, ['a[href]'], 'title'));
    const imageAlt = normalizeText(firstAttr($, card, ['img'], 'alt'));
    const title = firstText($, card, [
      '[class*="qa-advert-title"]',
      '[class*="b-advert-title"]',
      '[data-testid*="title"]',
      'h4 a',
      'h3 a',
      'h2 a'
    ]) || linkTitle || imageAlt;
    const description = firstText($, card, [
      '[class*="description"]',
      '[class*="qa-advert-description"]',
      '[data-testid*="description"]',
      'p'
    ]) || title;
    const price = firstText($, card, [
      '[class*="qa-advert-price"]',
      '[class*="b-advert-price"]',
      '[data-testid*="price"]',
      '[class*="price"]'
    ]);
    const location = firstText($, card, [
      '[class*="region"]',
      '[class*="location"]',
      '[class*="b-list-advert__region"]',
      '[data-testid*="location"]'
    ]);
    const postedRaw = firstText($, card, [
      '[class*="date"]',
      'time',
      '[data-testid*="date"]'
    ]);
    const posted = resolvePostedAt(postedRaw, { maxAgeDays });
    if (!posted.isRecent) return;

    const imageUrls = collectImageUrls($, card, BASE_URL);
    const phoneNumbers = extractPhoneNumbers(`${title} ${description}`);
    const priceNumeric = parsePriceNumeric(price);

    if (!title || !sourceUrl) return;

    results.push({
      title,
      description,
      price: price || 'Price on request',
      priceNumeric,
      imageUrls,
      location: location || 'Nigeria',
      source: SOURCE_TAG,
      category: inferMarketplaceCategory(title, description, category),
      sourceUrl,
      postedAt: posted.date.toISOString(),
      postedAtConfidence: posted.confidence,
      createdAt: nowIso,
      updatedAt: nowIso,
      status: 'pending-review',
      isScraped: true,
      dataSource: 'scraped',
      agentName: '',
      phoneNumbers,
      phoneNumber: phoneNumbers[0] || '',
      whatsappNumber: phoneNumbers[0] || '',
      contactPhone: phoneNumbers[0] || '',
      sourceMetadata: {
        sourceName: SOURCE_NAME,
        targetUrl,
        scrapedAt: nowIso,
        detailFetched: false
      }
    });
  });

  const enriched = await maybeEnrichDetails(results, options);
  return enriched
    .map((item) => ({
      ...item,
      imageUrls: normalizeImageUrls(item.imageUrls, BASE_URL),
      priceNumeric: parsePriceNumeric(item.price || item.priceNumeric),
      category: inferMarketplaceCategory(item.title, item.description, item.category || category)
    }))
    .filter((item) => item.title && item.sourceUrl && item.imageUrls.length && isUsablePrice(item.priceNumeric))
    .slice(0, limit);
}

module.exports = {
  scrapeJiji
};
