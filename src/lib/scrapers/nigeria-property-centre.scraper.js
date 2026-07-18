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

const SOURCE_NAME = 'nigeria-property-centre';
const SOURCE_TAG = 'NPC';
const BASE_URL = 'https://nigeriapropertycentre.com';
const MAX_AGE_DAYS = 60;

const CATEGORY_URLS = {
  property: `${BASE_URL}/for-rent`,
  housemates: `${BASE_URL}/flatmates`,
  'shared-housing': `${BASE_URL}/flatmates`,
  'shared-housing-roommates': `${BASE_URL}/flatmates`
};

const PROPERTY_LISTING_URLS = {
  rent: `${BASE_URL}/for-rent`,
  sale: `${BASE_URL}/for-sale`
};

function normalizeCategory(value) {
  const normalized = normalizeText(value || 'property').toLowerCase();
  if (normalized === 'shared') return 'shared-housing';
  if (normalized === 'flatmates') return 'housemates';
  return normalized || 'property';
}

function normalizeListingType(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (['sale', 'sell', 'buy', 'for-sale', 'for sale'].includes(normalized)) return 'sale';
  if (['rent', 'rental', 'let', 'lease', 'for-rent', 'for rent'].includes(normalized)) return 'rent';
  return '';
}

function withPageNumber(url, pageNumber) {
  if (pageNumber <= 1) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('page', String(pageNumber));
    return parsed.toString();
  } catch {
    return url;
  }
}

function normalizeNpcPrice(value) {
  const text = normalizeText(value);
  const matches = text.match(/₦\s*[\d,]+(?:\s*per\s+[a-z/ ]+)?/gi);
  return matches?.[0] ? normalizeText(matches[0]) : text;
}

function findDetailDescription($, metaDescription = '') {
  const candidates = [];
  const selectors = [
    '.description',
    '.description-text',
    '.property-description',
    '.wp-block-property-description',
    '[class*="description"]',
    '.content p',
    'article p',
    'p'
  ];

  selectors.forEach((selector) => {
    $(selector).each((_, node) => {
      const text = stripHtml($(node).text())
        .replace(/^description\s*/i, '')
        .trim();

      if (!text || text.length < 80) return;
      if (/^(interested in this property|share this property|report this listing)/i.test(text)) return;
      candidates.push(text);
    });
  });

  const best = candidates
    .filter((text, index, list) => list.indexOf(text) === index)
    .sort((a, b) => b.length - a.length)[0];

  return best || stripHtml(metaDescription);
}

function parseFeatureNumber(value) {
  const match = normalizeText(value).replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  if (!match) return undefined;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parseTitleFeature(title, labelPattern) {
  const match = normalizeText(title).match(labelPattern);
  return match ? parseFeatureNumber(match[1]) : undefined;
}

function parseSquareMetersFromText(...values) {
  const text = values.map((value) => normalizeText(value)).filter(Boolean).join(' ');
  if (!text) return undefined;

  const patterns = [
    /(?:total\s+area|land\s+size|plot\s+size|floor\s+area|built[-\s]?up\s+area|property\s+size|area|size)\s*[:\-]?\s*(\d[\d,]*(?:\.\d+)?)\s*(?:sqm|sq\.?\s*m|m2|m²|square\s*met(?:er|re)s?)/i,
    /(\d[\d,]*(?:\.\d+)?)\s*(?:sqm|sq\.?\s*m|m2|m²|square\s*met(?:er|re)s?)\s*(?:total\s+area|land\s+size|plot\s+size|floor\s+area|built[-\s]?up\s+area|property\s+size|area|size)?/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = parseFeatureNumber(match?.[1]);
    if (value) return value;
  }

  return undefined;
}

function collectStructuredFeatures($) {
  const features = {};

  $('[itemprop="additionalProperty"], .aux-info li').each((_, node) => {
    const root = $(node);
    const name = normalizeText(
      root.find('[itemprop="name"]').first().text() ||
      root.find('.name').first().text() ||
      root.text().replace(root.find('[itemprop="value"]').first().text(), '')
    ).toLowerCase();
    const valueText = normalizeText(root.find('[itemprop="value"]').first().text());
    const unitText = normalizeText(root.find('[itemprop="unitText"]').first().text()).toLowerCase();
    const value = parseFeatureNumber(valueText);

    if (!name || !value) return;

    if (name.includes('bedroom')) features.bedrooms = value;
    if (name.includes('bathroom')) features.bathrooms = value;
    if (name.includes('toilet')) features.toilets = value;
    if (name.includes('parking')) features.parkingSpaces = value;
    if (name.includes('area') || name.includes('size') || unitText.includes('sqm')) {
      features.squareMeters = value;
      features.sizeUnit = unitText || 'sqm';
    }
  });

  return features;
}

function parseDetailPage(html, sourceUrl) {
  const cheerio = loadCheerio();
  const $ = cheerio.load(html);
  const bodyText = normalizeText($('body').text());
  const metaDescription = normalizeText($('meta[name="description"]').attr('content'));
  const pageTitle = normalizeText($('title').first().text());
  const title = normalizeText($('h1').first().text() || pageTitle);
  const description = findDetailDescription($, metaDescription);
  const rawPrice = firstText($, $.root(), [
    '.price',
    '.property-price',
    '.price-label',
    '.pull-right.price',
    '[class*="price"]'
  ]);
  const combinedPrice = normalizeText($('span.price, span.period, .property-price, .price-label').text());
  const price = normalizeNpcPrice(combinedPrice && combinedPrice !== '₦' ? combinedPrice : rawPrice);
  const location = firstText($, $.root(), [
    '.property-location',
    '.location',
    '.address',
    '.pull-left.location',
    '[class*="location"]'
  ]);
  const agentName = firstText($, $.root(), [
    '.agent-name',
    '.company-name',
    '[class*="agent"] h4',
    '[class*="agent"] [class*="name"]'
  ]);
  const phoneNumbers = extractPhoneNumbers(bodyText);
  const imageUrls = collectImageUrls($, $.root(), sourceUrl);
  const structuredFeatures = collectStructuredFeatures($);
  const bedrooms = structuredFeatures.bedrooms || parseTitleFeature(pageTitle, /(\d+(?:\.\d+)?)\s*beds?\b/i);
  const bathrooms = structuredFeatures.bathrooms || parseTitleFeature(pageTitle, /(\d+(?:\.\d+)?)\s*baths?\b/i);
  const squareMeters = structuredFeatures.squareMeters ||
    parseSquareMetersFromText(title, pageTitle, metaDescription, description);

  return {
    title,
    description,
    price,
    location,
    agentName,
    phoneNumbers,
    imageUrls,
    bedrooms,
    bathrooms,
    toilets: structuredFeatures.toilets,
    parkingSpaces: structuredFeatures.parkingSpaces,
    squareMeters,
    sizeUnit: structuredFeatures.sizeUnit || (squareMeters ? 'sqm' : undefined)
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
        bedrooms: detail.bedrooms || item.bedrooms,
        bathrooms: detail.bathrooms || item.bathrooms,
        toilets: detail.toilets || item.toilets,
        parkingSpaces: detail.parkingSpaces || item.parkingSpaces,
        squareMeters: detail.squareMeters || item.squareMeters,
        sizeUnit: detail.sizeUnit || item.sizeUnit,
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

async function scrapeNigeriaPropertyCentre(options = {}) {
  const category = normalizeCategory(options.category || 'property');
  const limit = Math.max(1, Math.min(parseInt(options.limit, 10) || 50, 500));
  const requestedListingType = normalizeListingType(options.listingType || options.propertyPurpose);
  const targetUrl = normalizeText(options.url) ||
    (category === 'property' && requestedListingType
      ? PROPERTY_LISTING_URLS[requestedListingType]
      : CATEGORY_URLS[category]) ||
    CATEGORY_URLS.property;
  const maxAgeDays = Number(options.maxAgeDays || MAX_AGE_DAYS);
  const nowIso = new Date().toISOString();
  const cheerio = loadCheerio();
  const results = [];
  const seenSourceUrls = new Set();
  const maxPages = Math.max(
    1,
    Math.min(
      Number(options.maxPages || Math.ceil(limit / 15) + 2),
      10
    )
  );

  for (let pageNumber = 1; pageNumber <= maxPages && results.length < limit; pageNumber += 1) {
    const pageUrl = withPageNumber(targetUrl, pageNumber);
    const html = await fetchHtmlWithRetry(pageUrl, {
      delayMs: Number(options.delayMs || 0),
      retries: Number(options.retries ?? 2),
      referer: BASE_URL
    });

    const $ = cheerio.load(html);
    const cards = $('.property-list, .property-listing, .single-room-text, .wp-block.property-list, .row.property-list');
    if (!cards.length) break;

    cards.each((_, card) => {
      if (results.length >= limit) return false;

      const sourceUrl = toAbsoluteUrl(firstAttr($, card, ['h4 a', 'h3 a', '.property-title a', 'a[href]'], 'href'), BASE_URL);
      if (!sourceUrl || seenSourceUrls.has(sourceUrl)) return;
      seenSourceUrls.add(sourceUrl);
    const linkTitle = normalizeText(firstAttr($, card, ['a[href]'], 'title'));
    const imageAlt = normalizeText(firstAttr($, card, ['img'], 'alt'));
    const title = firstText($, card, [
      'h4 a',
      'h3 a',
      '.property-title a',
      '.content h3 a',
      '[class*="title"]'
    ]) || linkTitle || imageAlt;
    const description = firstText($, card, [
      '.description',
      '.description-text',
      '.summary',
      '.property-description',
      'p'
    ]) || title;
    const rawPrice = firstText($, card, [
      '.price',
      '.property-price',
      '.price-label',
      '.pull-right.price',
      '[class*="price"]'
    ]);
    const combinedPrice = normalizeText($(card).find('span.price, span.period, .property-price, .price-label').text());
    const price = normalizeNpcPrice(combinedPrice && combinedPrice !== '₦' ? combinedPrice : rawPrice);
    const location = firstText($, card, [
      'address',
      '.property-location',
      '.location',
      '.address',
      '.pull-left.location',
      '[class*="location"]'
    ]);
    const postedRaw = normalizeText($(card).find('span.added-on, .date-added, .property-date, time').first().text()) || firstText($, card, [
      '.added-on',
      '.date-added',
      '.property-date',
      '.added',
      'time',
      '[class*="date"]'
    ]);
    const posted = resolvePostedAt(postedRaw, { maxAgeDays });
    if (!posted.isRecent) return;

    const imageUrls = collectImageUrls($, card, BASE_URL);
    const cardText = normalizeText($(card).text());
    const phoneNumbers = extractPhoneNumbers(`${title} ${description} ${cardText}`);
    const agentName = normalizeText($(card).find('.marketed-by').text()).replace(/\+?234|0\d[\d\s-]{8,}/g, '').trim();

    if (!title || !sourceUrl) return;

    results.push({
      title,
      description,
      price: price || 'Price on request',
      priceNumeric: parsePriceNumeric(price),
      imageUrls,
      location: location || 'Nigeria',
      source: SOURCE_TAG,
      category,
      sourceUrl,
      postedAt: posted.date.toISOString(),
      postedAtConfidence: posted.confidence,
      createdAt: nowIso,
      updatedAt: nowIso,
      status: 'pending-review',
      listingType: requestedListingType,
      isScraped: true,
      dataSource: 'scraped',
      agentName,
      phoneNumbers,
      phoneNumber: phoneNumbers[0] || '',
      whatsappNumber: phoneNumbers[0] || '',
      contactPhone: phoneNumbers[0] || '',
      sourceMetadata: {
        sourceName: SOURCE_NAME,
        targetUrl,
        pageUrl,
        pageNumber,
        scrapedAt: nowIso,
        detailFetched: false
      }
    });
    });
  }

  const enriched = await maybeEnrichDetails(results, options);
  return enriched
    .map((item) => ({
      ...item,
      imageUrls: normalizeImageUrls(item.imageUrls, BASE_URL),
      priceNumeric: parsePriceNumeric(item.price || item.priceNumeric)
    }))
    .filter((item) => item.title && item.sourceUrl && item.imageUrls.length && isUsablePrice(item.priceNumeric))
    .slice(0, limit);
}

module.exports = {
  parseDetailPage,
  scrapeNigeriaPropertyCentre
};
