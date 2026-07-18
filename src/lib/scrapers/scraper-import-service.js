const { getAutomationFirestore } = require('../automation/admin-firestore');
const { createOnboardingQueueItem } = require('../automation/onboarding-queue-adapter.cjs');
const {
  isUsablePrice,
  normalizeImageUrls,
  normalizeText,
  parsePriceNumeric
} = require('./scraper-utils');
const { applyGeneratedDescription } = require('./listing-description-generator');
const {
  isAppDbEnabled,
  upsertPublicListings
} = require('../db/listing-repository.cjs');
const {
  createScrapedDocId,
  getDefaultSourceIndexPath,
  getPublicSlugIdPart,
  getSourceIndexEntry,
  getSourceIndexKey,
  hasSavedSource,
  loadSourceIndex,
  saveSourceIndex,
  upsertSourceIndexEntry
} = require('./scraper-source-index');

const SOURCE_TAG_MAP = {
  'nigeria-property-centre': 'NPC',
  jiji: 'Jiji',
  locanto: 'Locanto'
};

const MARKETPLACE_CATEGORIES = new Set(['marketplace', 'phones', 'electronics', 'cars']);
const PROPERTY_CATEGORIES = new Set(['property', 'housemates', 'shared-housing', 'shared-housing-roommates']);

function slugify(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^\w\s-]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function generateDocumentSlug(title, docId) {
  const base = slugify(title) || 'property-listing';
  return `${base}-${String(docId || '').slice(0, 8)}`;
}

function inferListingType(item) {
  const explicit = normalizeText(item.listingType).toLowerCase();
  if (['rent', 'sale'].includes(explicit)) return explicit;

  const haystack = [
    item.title,
    item.description,
    item.price,
    item.category,
    item.sourceUrl
  ].filter(Boolean).join(' ').toLowerCase();

  if (/for-rent|rent|rental|to let|lease|per annum|per month|yearly|monthly/.test(haystack)) {
    return 'rent';
  }
  if (/for-sale|sale|buy|purchase|selling/.test(haystack)) {
    return 'sale';
  }
  return '';
}

function inferPropertyType(item) {
  const explicit = normalizeText(item.propertyType || item.type).toLowerCase();
  if (explicit) return explicit;

  const haystack = [item.title, item.description, item.sourceUrl].filter(Boolean).join(' ').toLowerCase();
  if (/flat|apartment|mini flat/.test(haystack)) return 'apartment';
  if (/duplex|house|mansion|terrace|bungalow/.test(haystack)) return 'house';
  if (/office|shop|warehouse|commercial/.test(haystack)) return 'commercial';
  if (/land|plot/.test(haystack)) return 'land';
  return 'house';
}

function inferRoomCount(item, fieldName, patterns) {
  const explicit = Number(item?.[fieldName]);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;

  const haystack = [
    item?.title,
    item?.description,
    item?.sourceUrl
  ].filter(Boolean).join(' ').toLowerCase();

  for (const pattern of patterns) {
    const match = haystack.match(pattern);
    if (match) {
      const value = Number(match[1]);
      if (Number.isFinite(value) && value > 0 && value < 100) return value;
    }
  }

  return undefined;
}

function inferAddressFromLocation(location) {
  const parts = normalizeText(location)
    .split(',')
    .map((part) => normalizeText(part))
    .filter(Boolean);

  if (parts.length === 0) return undefined;

  const state = parts[parts.length - 1] || '';
  const town = parts.length > 1 ? parts[parts.length - 2] : '';
  const street = parts.slice(0, Math.max(1, parts.length - 2)).join(', ');

  return removeUndefined({
    street,
    town,
    state
  });
}

function normalizeCategory(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return '';
  if (normalized === 'classified') return 'noticeboard';
  if (normalized === 'shared') return 'shared-housing';
  if (normalized === 'flatmates') return 'housemates';
  if (normalized === 'mobile-phones' || normalized === 'phone') return 'phones';
  return normalized;
}

function resolveCollectionName(category) {
  if (MARKETPLACE_CATEGORIES.has(category)) return 'marketplace';
  if (PROPERTY_CATEGORIES.has(category)) return 'properties';
  if (category === 'noticeboard') return 'noticeboard';
  return null;
}

function safeDate(value, fallback = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function removeUndefined(value) {
  if (Array.isArray(value)) {
    return value.map(removeUndefined).filter((item) => item !== undefined);
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const cleaned = {};
    Object.entries(value).forEach(([key, item]) => {
      const next = removeUndefined(item);
      if (next !== undefined) cleaned[key] = next;
    });
    return cleaned;
  }
  return value === undefined ? undefined : value;
}

function shouldSyncPostgres() {
  const value = normalizeText(process.env.SCRAPER_POSTGRES_SYNC || 'true').toLowerCase();
  return !['0', 'false', 'no', 'off'].includes(value);
}

function getScraperWriteTarget() {
  const target = normalizeText(process.env.SCRAPER_WRITE_TARGET || 'both').toLowerCase();
  if (['postgres', 'firestore', 'both'].includes(target)) return target;
  return 'both';
}

async function syncInsertedItemsToPostgres(collectionName, insertedItems) {
  if (!insertedItems.length || !shouldSyncPostgres() || !isAppDbEnabled()) {
    return { synced: 0, skipped: insertedItems.length };
  }

  try {
    const result = await upsertPublicListings(collectionName, insertedItems);
    return { synced: result.upserted || 0, skipped: result.skipped || 0 };
  } catch (error) {
    console.warn('[scraper] PostgreSQL public listing sync skipped:', error.message);
    return { synced: 0, skipped: insertedItems.length, error: error.message };
  }
}

function buildFallbackKey(item) {
  const source = normalizeText(item.source).toLowerCase();
  const title = normalizeText(item.title).toLowerCase();
  const location = normalizeText(item.location).toLowerCase();
  const postedAt = normalizeText(item.postedAt);
  return `${source}|${title}|${location}|${postedAt}`;
}

function normalizePhoneList(item) {
  const phones = []
    .concat(item.phoneNumbers || [])
    .concat(item.whatsappNumber || [])
    .concat(item.phoneNumber || [])
    .concat(item.contactPhone || [])
    .concat(item.phone || [])
    .filter(Boolean)
    .map((phone) => normalizeText(phone));
  return Array.from(new Set(phones)).slice(0, 5);
}

function enrichItem(rawItem, category, canonicalSource, now = new Date()) {
  const item = rawItem || {};
  const title = normalizeText(item.title);
  const description = normalizeText(item.description) || title;
  const sourceUrl = normalizeText(item.sourceUrl);
  const price = normalizeText(item.price);
  const priceNumeric = parsePriceNumeric(price || item.priceNumeric);
  const imageUrls = normalizeImageUrls(item.imageUrls, sourceUrl || undefined);
  const phoneNumbers = normalizePhoneList(item);

  if (!title || !sourceUrl || !imageUrls.length || !isUsablePrice(priceNumeric)) {
    return null;
  }

  const sourceTag = SOURCE_TAG_MAP[canonicalSource] || normalizeText(item.source) || canonicalSource;
  const createdAt = safeDate(item.createdAt, now);
  const updatedAt = safeDate(item.updatedAt, now);
  const postedAt = safeDate(item.postedAt, now);
  const location = normalizeText(item.location) || 'Nigeria';
  const agentName = normalizeText(item.agentName || item.sellerName || item.contactName);
  const propertyType = inferPropertyType(item);
  const bedrooms = inferRoomCount(item, 'bedrooms', [
    /(\d+)\s*(?:bedroom|bed room|bed|br)\b/,
    /(\d+)-\s*(?:bedroom|bed room|bed|br)\b/
  ]);
  const bathrooms = inferRoomCount(item, 'bathrooms', [
    /(\d+)\s*(?:bathroom|bath room|bath|ba)\b/,
    /(\d+)-\s*(?:bathroom|bath room|bath|ba)\b/
  ]);
  const toilets = inferRoomCount(item, 'toilets', [
    /(\d+)\s*(?:toilet|wc)\b/,
    /(\d+)-\s*(?:toilet|wc)\b/
  ]);

  return removeUndefined({
    title,
    description,
    price: price || 'Price on request',
    priceNumeric,
    imageUrls,
    location,
    source: sourceTag,
    category,
    sourceUrl,
    postedAt,
    postedAtConfidence: normalizeText(item.postedAtConfidence),
    createdAt,
    updatedAt,
    status: process.env.SCRAPER_IMPORTED_STATUS || 'active',
    isScraped: true,
    isScrapedData: true,
    dataSource: 'scraped',
    titleLower: title.toLowerCase(),
    locationLower: location.toLowerCase(),
    agentName,
    phoneNumbers,
    phoneNumber: phoneNumbers[0] || '',
    whatsappNumber: phoneNumbers[0] || '',
    contactPhone: phoneNumbers[0] || '',
    contact: {
      ...(item.contact || {}),
      name: agentName || item.contact?.name || '',
      phone: phoneNumbers[0] || item.contact?.phone || ''
    },
    sourceMetadata: item.sourceMetadata || {},
    originalCategory: item.category || '',
    bedrooms,
    bathrooms,
    toilets,
    parkingSpaces: item.parkingSpaces,
    squareMeters: item.squareMeters,
    size: item.squareMeters,
    sizeUnit: item.sizeUnit,
    type: propertyType,
    propertyType,
    listingType: inferListingType(item),
    address: item.address || inferAddressFromLocation(location)
  });
}

async function saveScrapedItems(db, collectionName, scrapedItems, category, canonicalSource) {
  const writeTarget = getScraperWriteTarget();
  const writeFirestore = writeTarget !== 'postgres';
  const writePostgres = writeTarget !== 'firestore';
  const firestore = writeFirestore ? (db || getAutomationFirestore()) : null;
  const collectionRef = firestore?.collection(collectionName);
  const now = new Date();
  const localSeen = new Set();
  const toInsert = [];
  const queueOnlyItems = [];
  const indexPath = getDefaultSourceIndexPath(collectionName);
  const sourceIndex = loadSourceIndex(indexPath);

  for (const rawItem of scrapedItems || []) {
    const enriched = enrichItem(rawItem, category, canonicalSource, now);
    if (!enriched) continue;

    const fallbackKey = buildFallbackKey(enriched);
    const dedupeKey = enriched.sourceUrl || fallbackKey;
    const sourceKey = getSourceIndexKey({ ...enriched, dedupeKey });
    if (!sourceKey || localSeen.has(sourceKey)) continue;
    localSeen.add(sourceKey);

    if (hasSavedSource(sourceIndex, sourceKey)) {
      const existingEntry = getSourceIndexEntry(sourceIndex, sourceKey);
      upsertSourceIndexEntry(sourceIndex, sourceKey, {
        lastTitle: enriched.title,
        lastLocation: enriched.location,
        imageCount: enriched.imageUrls.length,
        lastSourceUrl: enriched.sourceUrl || '',
        lastSeenAt: now.toISOString()
      });

      if (collectionName === 'properties' && existingEntry?.onboardingQueued !== true) {
        const docId = existingEntry?.docId || createScrapedDocId(sourceKey);
        const slug = existingEntry?.slug || generateDocumentSlug(enriched.title, getPublicSlugIdPart(docId));
        queueOnlyItems.push({ id: docId, ...enriched, dedupeKey, slug });
      }
      continue;
    }

    const itemWithGeneratedDescription = await applyGeneratedDescription(enriched);
    const docId = createScrapedDocId(sourceKey);
    toInsert.push({ ...itemWithGeneratedDescription, dedupeKey, docId, sourceKey });
  }

  let insertedCount = 0;
  const insertedItems = [];
  for (let i = 0; i < toInsert.length; i += 450) {
    const chunk = toInsert.slice(i, i + 450);
    const batch = writeFirestore ? firestore.batch() : null;
    const preparedItems = [];

    chunk.forEach((item) => {
      const docId = item.docId;
      const docRef = writeFirestore ? collectionRef.doc(docId) : { id: docId };
      const slugIdPart = getPublicSlugIdPart(docId);
      const itemWithSlug = {
        ...item,
        slug: item.slug || generateDocumentSlug(item.title, slugIdPart)
      };
      delete itemWithSlug.docId;
      delete itemWithSlug.sourceKey;
      if (writeFirestore) batch.set(docRef, itemWithSlug, { merge: true });
      preparedItems.push({ id: docRef.id, ...itemWithSlug });
    });

    if (writeFirestore) {
      await batch.commit();
    }
    insertedItems.push(...preparedItems);
    insertedCount += chunk.length;

    chunk.forEach((item) => {
      const saved = preparedItems.find((inserted) => inserted.id === item.docId);
      upsertSourceIndexEntry(sourceIndex, item.sourceKey, {
        docId: item.docId,
        slug: saved?.slug || '',
        sourceUrl: item.sourceUrl || '',
        dedupeKey: item.dedupeKey || '',
        title: item.title || '',
        location: item.location || '',
        imageCount: item.imageUrls?.length || 0,
        savedAt: now.toISOString(),
        savedToFirestore: writeFirestore,
        savedToPostgres: writePostgres,
        collectionName,
        source: canonicalSource || item.source || ''
      });
    });
  }

  const postgresSync = writePostgres
    ? await syncInsertedItemsToPostgres(collectionName, insertedItems)
    : { synced: 0, skipped: insertedItems.length };

  const queueCandidates = collectionName === 'properties'
    ? [...insertedItems, ...queueOnlyItems]
    : [];

  if (queueCandidates.length > 0) {
    const queueResults = await Promise.allSettled(
      queueCandidates.map((item) =>
        createOnboardingQueueItem({
          db: firestore,
          collectionName,
          advertId: item.id,
          listing: item
        })
      )
    );
    queueResults.forEach((result, index) => {
      const inserted = queueCandidates[index];
      const sourceKey = getSourceIndexKey(inserted);
      if (!sourceKey || result.status !== 'fulfilled') return;
      upsertSourceIndexEntry(sourceIndex, sourceKey, {
        onboardingQueued: Boolean(result.value?.queued || result.value?.reason === 'already_queued'),
        onboardingQueueId: result.value?.queueId || '',
        onboardingQueueStatus: result.value?.reason || (result.value?.queued ? 'queued' : ''),
        onboardingCheckedAt: new Date().toISOString()
      });
    });
  }

  saveSourceIndex(sourceIndex, indexPath);

  return {
    insertedCount,
    skippedCount: Math.max(0, (scrapedItems || []).length - insertedCount),
    insertedItems,
    postgresSync,
    writeTarget
  };
}

module.exports = {
  enrichItem,
  normalizeCategory,
  resolveCollectionName,
  saveScrapedItems
};
