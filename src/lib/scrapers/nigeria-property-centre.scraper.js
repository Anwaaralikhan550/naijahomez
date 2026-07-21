const {
  collectImageUrls,
  extractPhoneNumbers,
  fetchHtmlWithRetry,
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

// The site's frontend markup (CSS classes) is a redesign risk -- it's been
// rebuilt from semantic class names (.property-list, .property-price, ...)
// to generic Tailwind utility classes at least once already (2026-07). JSON-LD
// structured data is what the site exposes for Google/SEO, which is a much
// stronger stability guarantee than any CSS class name, so it's the primary
// extraction source here. Regex-against-body-text (phone numbers, bed/bath
// counts) and URL-path parsing (location) are the secondary sources, since
// those don't depend on markup/class names either. CSS selectors are kept
// only as a last-resort fallback, not the primary path.
function parseJsonLd($, matchType) {
  const blocks = [];
  $('script[type="application/ld+json"]').each((_, node) => {
    try {
      const parsed = JSON.parse($(node).html() || 'null');
      blocks.push(parsed);
    } catch {
      // Malformed JSON-LD block -- skip it, other blocks may still be usable.
    }
  });

  return blocks.find((block) => {
    if (!block) return false;
    const type = block['@type'];
    return type === matchType || (Array.isArray(type) && type.includes(matchType));
  }) || null;
}

function normalizeNpcPrice(value) {
  const text = normalizeText(value);
  const matches = text.match(/₦\s*[\d,]+(?:\s*per\s+[a-z/ ]+)?/gi);
  return matches?.[0] ? normalizeText(matches[0]) : text;
}

function extractFeatureCount(text, pattern) {
  const match = normalizeText(text).match(pattern);
  if (!match) return undefined;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

// Location isn't in the JSON-LD RealEstateListing block, but the URL path
// itself encodes it reliably: /for-rent/{type}/{subtype}/{state}/{area}/{id}-{slug}
// This is baked into the site's routing/SEO structure, so it's about as
// stable a source as JSON-LD -- much more so than a CSS-selected element.
function extractLocationFromUrl(sourceUrl) {
  try {
    const segments = new URL(sourceUrl).pathname.split('/').filter(Boolean);
    // segments: ['for-rent', '<type>', '<subtype>', '<state>', '<area>', '<id-slug>']
    // or sometimes shorter (no subtype). The last segment is always the id-slug,
    // and the two immediately before it (when present) are area/state.
    const withoutIdSlug = segments.slice(0, -1);
    const locationParts = withoutIdSlug.slice(-2).map((part) =>
      part.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    );
    return locationParts.filter(Boolean).reverse().join(', ');
  } catch {
    return '';
  }
}

function findDetailDescription($, metaDescription = '') {
  const candidates = [];
  const selectors = ['.description', '.description-text', '.property-description', '[class*="description"]', 'article p', 'p'];

  selectors.forEach((selector) => {
    $(selector).each((_, node) => {
      const text = stripHtml($(node).text()).replace(/^description\s*/i, '').trim();
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

function parseDetailPage(html, sourceUrl) {
  const cheerio = loadCheerio();
  const $ = cheerio.load(html);
  const bodyText = normalizeText($('body').text());
  const metaDescription = normalizeText($('meta[name="description"]').attr('content'));
  const pageTitle = normalizeText($('title').first().text());

  const listing = parseJsonLd($, 'RealEstateListing') || {};
  const title = normalizeText(listing.name) || normalizeText($('h1').first().text()) || pageTitle;
  const description = normalizeText(listing.description) || findDetailDescription($, metaDescription);
  const price = listing.offers?.price
    ? normalizeNpcPrice(`₦${Number(listing.offers.price).toLocaleString('en-NG')}`)
    : normalizeNpcPrice($('body').find('[class*="price"]').first().text());
  const location = extractLocationFromUrl(sourceUrl) || normalizeText($('[class*="location"], address').first().text());
  const phoneNumbers = extractPhoneNumbers(bodyText);

  const jsonLdImages = [listing.image].flat().filter(Boolean).map((url) => toAbsoluteUrl(url, sourceUrl));
  const scannedImages = collectImageUrls($, $.root(), sourceUrl);
  const imageUrls = Array.from(new Set([...jsonLdImages, ...scannedImages]));

  const bedrooms = extractFeatureCount(bodyText, /(\d+)\s*beds?\b/i) || extractFeatureCount(pageTitle, /(\d+(?:\.\d+)?)\s*beds?\b/i);
  const bathrooms = extractFeatureCount(bodyText, /(\d+)\s*baths?\b/i) || extractFeatureCount(pageTitle, /(\d+(?:\.\d+)?)\s*baths?\b/i);
  const toilets = extractFeatureCount(bodyText, /(\d+)\s*toilets?\b/i);

  return {
    title,
    description,
    price: price || 'Price on request',
    location,
    agentName: '',
    phoneNumbers,
    imageUrls,
    bedrooms,
    bathrooms,
    toilets,
    datePosted: listing.datePosted || null
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
        agentName: detail.agentName || item.agentName,
        phoneNumbers,
        phoneNumber: phoneNumbers[0] || item.phoneNumber,
        whatsappNumber: phoneNumbers[0] || item.whatsappNumber,
        contactPhone: phoneNumbers[0] || item.contactPhone,
        postedAt: detail.datePosted || item.postedAt,
        postedAtConfidence: detail.datePosted ? 'explicit' : item.postedAtConfidence,
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
    const itemList = parseJsonLd($, 'ItemList');
    const listItems = Array.isArray(itemList?.itemListElement) ? itemList.itemListElement : [];
    if (!listItems.length) break;

    listItems.forEach((listItem) => {
      if (results.length >= limit) return;

      const sourceUrl = toAbsoluteUrl(listItem?.url, BASE_URL);
      const title = normalizeText(listItem?.name);
      if (!sourceUrl || !title || seenSourceUrls.has(sourceUrl)) return;
      seenSourceUrls.add(sourceUrl);

      // Full recency + price/image enrichment happens in maybeEnrichDetails
      // (fetches this listing's own detail page, which has datePosted via
      // JSON-LD) -- the listing page's JSON-LD ItemList doesn't carry dates,
      // so a placeholder "recent" is used here and corrected after detail
      // fetch. When --detail isn't passed (rare -- production always uses
      // it), this falls back to treating everything as recent.
      results.push({
        title,
        description: title,
        price: 'Price on request',
        priceNumeric: undefined,
        imageUrls: [],
        location: extractLocationFromUrl(sourceUrl) || 'Nigeria',
        source: SOURCE_TAG,
        category,
        sourceUrl,
        postedAt: nowIso,
        postedAtConfidence: 'fallback_now',
        createdAt: nowIso,
        updatedAt: nowIso,
        status: 'pending-review',
        listingType: requestedListingType,
        isScraped: true,
        dataSource: 'scraped',
        agentName: '',
        phoneNumbers: [],
        phoneNumber: '',
        whatsappNumber: '',
        contactPhone: '',
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
    .filter((item) => {
      const posted = resolvePostedAt(item.postedAt, { maxAgeDays });
      return posted.isRecent;
    })
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
