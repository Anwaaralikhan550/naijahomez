const { query, isAppDbEnabled } = require('./postgres-client.cjs');

const VALID_COLLECTIONS = new Set(['properties', 'marketplace', 'services', 'housemates', 'noticeboard']);
const VALID_SORT_FIELDS = new Set(['createdAt', 'updatedAt', 'price', 'priceNumeric', 'rating']);

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeCollectionName(collectionName) {
  const normalized = normalizeText(collectionName);
  if (!VALID_COLLECTIONS.has(normalized)) {
    throw new Error(`Unsupported listing collection "${collectionName}".`);
  }
  return normalized;
}

function normalizeListingType(value) {
  const normalized = normalizeText(value).toLowerCase().replace(/[_\s]+/g, '-');
  if (['rent', 'for-rent', 'forrent'].includes(normalized)) return 'rent';
  if (['sale', 'for-sale', 'forsale'].includes(normalized)) return 'sale';
  return '';
}

function parsePriceValue(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const raw = String(value).trim().toLowerCase();
  if (!raw) return null;
  const compact = raw.replace(/,/g, '');
  const shortMatch = compact.match(/(\d+(?:\.\d+)?)\s*([mk])/i);
  if (shortMatch) {
    const base = parseFloat(shortMatch[1]);
    if (!Number.isNaN(base)) return base * (shortMatch[2].toLowerCase() === 'm' ? 1000000 : 1000);
  }

  const cleaned = compact.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const parsed = parseFloat(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
}

function numberOrNull(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function intOrNull(value) {
  const numeric = parseInt(value, 10);
  return Number.isFinite(numeric) ? numeric : null;
}

function dateOrNull(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value === 'object' && Number.isFinite(value._seconds)) {
    return new Date(value._seconds * 1000 + Math.floor((value._nanoseconds || 0) / 1000000));
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isoOrNull(value) {
  const date = dateOrNull(value);
  return date ? date.toISOString() : null;
}

function normalizeImages(item = {}) {
  const raw = Array.isArray(item.imageUrls)
    ? item.imageUrls
    : Array.isArray(item.images)
      ? item.images
      : item.imageUrls
        ? [item.imageUrls]
        : item.images
          ? [item.images]
          : [];

  return [...new Set(raw.map((image) => normalizeText(image)).filter(Boolean))];
}

function getPrimaryPhone(item = {}) {
  const phones = []
    .concat(item.whatsappNumber || [])
    .concat(item.phoneNumber || [])
    .concat(item.contactPhone || [])
    .concat(item.phone || [])
    .concat(item.contact?.phone || [])
    .concat(item.providerContact || [])
    .concat(item.phoneNumbers || [])
    .map((phone) => normalizeText(phone))
    .filter(Boolean);
  return phones[0] || '';
}

function getPriceNumeric(item = {}) {
  return (
    parsePriceValue(item.priceNumeric) ??
    parsePriceValue(item.saleDetails?.price) ??
    parsePriceValue(item.rentAmount?.monthly) ??
    parsePriceValue(item.rentAmount?.annual) ??
    parsePriceValue(item.rentAmount) ??
    parsePriceValue(item.price) ??
    null
  );
}

function serializeData(value) {
  return JSON.stringify(value, (_key, entry) => {
    if (entry instanceof Date) return entry.toISOString();
    if (entry && typeof entry.toDate === 'function') return entry.toDate().toISOString();
    return entry === undefined ? null : entry;
  });
}

function getStableSlugSuffix(id) {
  return normalizeText(id)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(-10) || Math.random().toString(36).slice(2, 10);
}

async function resolveUniqueSlug(record) {
  const baseSlug = normalizeText(record.slug);
  if (!baseSlug) return baseSlug;

  const suffix = getStableSlugSuffix(record.id);
  let candidate = baseSlug;

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const existing = await query(
      `SELECT id
       FROM public_listings
       WHERE collection_name = $1 AND slug = $2
       LIMIT 1`,
      [record.collectionName, candidate]
    );

    if (!existing.rows.length || existing.rows[0].id === record.id) {
      return candidate;
    }

    candidate = `${baseSlug}-${suffix}${attempt > 0 ? `-${attempt + 1}` : ''}`;
  }

  return `${baseSlug}-${suffix}-${Date.now()}`;
}

function applyResolvedSlug(record, slug) {
  if (!slug || slug === record.slug) return record;

  let data = {};
  try {
    data = JSON.parse(record.data || '{}');
  } catch (_error) {
    data = {};
  }

  return {
    ...record,
    slug,
    data: serializeData({
      ...data,
      slug
    })
  };
}

function buildPublicListingRecord(collectionName, input = {}) {
  const collection = normalizeCollectionName(collectionName);
  const item = { ...input };
  const id = normalizeText(item.id || item.docId);
  const slug = normalizeText(item.slug);
  const title = normalizeText(item.title);

  if (!id || !slug || !title) {
    return null;
  }

  const imageUrls = normalizeImages(item);
  const phone = getPrimaryPhone(item);
  const priceNumeric = getPriceNumeric(item);
  const createdAt = dateOrNull(item.createdAt) || new Date();
  const updatedAt = dateOrNull(item.updatedAt) || createdAt;
  const listingType = normalizeListingType(item.listingType);

  return {
    collectionName: collection,
    id,
    slug,
    title,
    description: normalizeText(item.description),
    location: normalizeText(item.location),
    priceText: normalizeText(item.price || item.priceString),
    priceNumeric,
    listingType,
    propertyType: normalizeText(item.propertyType || item.type).toLowerCase(),
    serviceType: normalizeText(item.serviceType),
    category: normalizeText(item.category || item.subCategory || item.subcategory),
    condition: normalizeText(item.condition),
    status: normalizeText(item.status || 'active').toLowerCase(),
    imageUrls,
    phone,
    whatsappNumber: normalizeText(item.whatsappNumber || phone),
    agentName: normalizeText(item.agentName || item.provider || item.contact?.name || item.sellerName),
    userId: normalizeText(item.userId),
    kycStatus: normalizeText(item.kycStatus),
    source: normalizeText(item.source || item.dataSource),
    sourceUrl: normalizeText(item.sourceUrl),
    dedupeKey: normalizeText(item.dedupeKey || item.sourceUrl),
    isScraped: Boolean(item.isScraped || item.isScrapedData || item.dataSource === 'scraped'),
    bedrooms: intOrNull(item.bedrooms),
    bathrooms: intOrNull(item.bathrooms),
    toilets: intOrNull(item.toilets),
    sizeValue: numberOrNull(item.size || item.squareMeters || item.area),
    sizeUnit: normalizeText(item.sizeUnit || (item.squareMeters ? 'sqm' : '')),
    postedAt: dateOrNull(item.postedAt),
    createdAt,
    updatedAt,
    data: serializeData({
      ...item,
      id,
      slug,
      imageUrls,
      images: imageUrls,
      priceNumeric,
      listingType: listingType || item.listingType || '',
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString()
    })
  };
}

function rowToListing(row = {}) {
  const data = row.data && typeof row.data === 'object' ? row.data : {};
  const imageUrls = Array.isArray(row.image_urls) ? row.image_urls : normalizeImages(data);
  const createdAt = isoOrNull(row.created_at) || data.createdAt || null;
  const updatedAt = isoOrNull(row.updated_at) || data.updatedAt || null;
  const postedAt = isoOrNull(row.posted_at) || data.postedAt || null;

  return {
    ...data,
    id: row.id,
    slug: row.slug,
    title: row.title || data.title || '',
    description: row.description || data.description || '',
    location: row.location || data.location || '',
    price: row.price_text || data.price || data.priceString || '',
    priceString: row.price_text || data.priceString || data.price || '',
    priceNumeric: row.price_numeric !== null && row.price_numeric !== undefined ? Number(row.price_numeric) : data.priceNumeric,
    listingType: row.listing_type || data.listingType || '',
    propertyType: row.property_type || data.propertyType || data.type || '',
    type: data.type || row.property_type || data.propertyType || '',
    serviceType: row.service_type || data.serviceType || '',
    category: row.category || data.category || '',
    condition: row.condition || data.condition || '',
    status: row.status || data.status || 'active',
    imageUrls,
    images: imageUrls,
    phoneNumber: data.phoneNumber || row.phone || '',
    whatsappNumber: data.whatsappNumber || row.whatsapp_number || row.phone || '',
    agentName: row.agent_name || data.agentName || data.provider || '',
    userId: row.user_id || data.userId || '',
    kycStatus: row.kyc_status || data.kycStatus || null,
    source: row.source || data.source || '',
    sourceUrl: row.source_url || data.sourceUrl || '',
    dedupeKey: row.dedupe_key || data.dedupeKey || '',
    isScraped: row.is_scraped ?? data.isScraped ?? false,
    bedrooms: row.bedrooms ?? data.bedrooms,
    bathrooms: row.bathrooms ?? data.bathrooms,
    toilets: row.toilets ?? data.toilets,
    size: row.size_value !== null && row.size_value !== undefined ? Number(row.size_value) : data.size,
    squareMeters: row.size_value !== null && row.size_value !== undefined ? Number(row.size_value) : data.squareMeters,
    sizeUnit: row.size_unit || data.sizeUnit || '',
    postedAt,
    createdAt,
    updatedAt
  };
}

function appendParam(params, value) {
  params.push(value);
  return `$${params.length}`;
}

function buildListingsWhere({ collectionName, search, minPrice, maxPrice, location, filters = {} }) {
  const params = [];
  const clauses = [
    `collection_name = ${appendParam(params, normalizeCollectionName(collectionName))}`,
    `status = ${appendParam(params, 'active')}`
  ];

  if (search) {
    const placeholder = appendParam(params, `%${normalizeText(search)}%`);
    clauses.push(`(title ILIKE ${placeholder} OR description ILIKE ${placeholder} OR location ILIKE ${placeholder})`);
  }

  if (location) {
    clauses.push(`location ILIKE ${appendParam(params, `%${normalizeText(location)}%`)}`);
  }

  const minPriceValue = parsePriceValue(minPrice);
  const maxPriceValue = parsePriceValue(maxPrice);
  if (minPriceValue !== null) clauses.push(`price_numeric >= ${appendParam(params, minPriceValue)}`);
  if (maxPriceValue !== null) clauses.push(`price_numeric <= ${appendParam(params, maxPriceValue)}`);

  if (filters.listingType) clauses.push(`listing_type = ${appendParam(params, normalizeListingType(filters.listingType))}`);
  if (filters.propertyType) clauses.push(`property_type = ${appendParam(params, normalizeText(filters.propertyType).toLowerCase())}`);
  if (filters.serviceType) clauses.push(`service_type = ${appendParam(params, normalizeText(filters.serviceType))}`);
  if (filters.category) {
    const category = normalizeText(filters.category).toLowerCase();
    clauses.push(`(lower(category) = ${appendParam(params, category)} OR lower(data->>'subcategory') = ${appendParam(params, category)} OR lower(data->>'subCategory') = ${appendParam(params, category)})`);
  }
  if (filters.condition) clauses.push(`lower(condition) = ${appendParam(params, normalizeText(filters.condition).toLowerCase())}`);
  if (filters.paymentType) clauses.push(`lower(data->>'paymentType') = ${appendParam(params, normalizeText(filters.paymentType).toLowerCase())}`);
  if (filters.collectionType) clauses.push(`lower(data->>'collectionType') = ${appendParam(params, normalizeText(filters.collectionType).toLowerCase())}`);
  if (filters.communityId) clauses.push(`data->>'communityId' = ${appendParam(params, normalizeText(filters.communityId))}`);
  if (filters.gender) clauses.push(`lower(data->>'gender') = ${appendParam(params, normalizeText(filters.gender).toLowerCase())}`);
  if (filters.roomType) clauses.push(`lower(data->>'roomType') = ${appendParam(params, normalizeText(filters.roomType).toLowerCase())}`);
  if (filters.advertType) clauses.push(`lower(data->>'advertType') = ${appendParam(params, normalizeText(filters.advertType).toLowerCase())}`);
  if (filters.bedrooms) clauses.push(`bedrooms = ${appendParam(params, intOrNull(filters.bedrooms))}`);
  if (filters.bathrooms) clauses.push(`bathrooms = ${appendParam(params, intOrNull(filters.bathrooms))}`);
  if (filters.featured) clauses.push(`COALESCE(NULLIF(data->>'rating', '')::NUMERIC, 0) >= 4`);
  if (Array.isArray(filters.tags) && filters.tags.length) {
    clauses.push(`EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(COALESCE(data->'tags', '[]'::jsonb)) tag
      WHERE lower(tag) = ANY(${appendParam(params, filters.tags.map((tag) => normalizeText(tag).toLowerCase()))}::text[])
    )`);
  }

  return { where: clauses.join(' AND '), params };
}

function resolveOrderBy(sortBy, sortOrder) {
  const direction = String(sortOrder || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const normalizedSort = VALID_SORT_FIELDS.has(sortBy) ? sortBy : 'createdAt';
  if (normalizedSort === 'price' || normalizedSort === 'priceNumeric') return `price_numeric ${direction} NULLS LAST, created_at DESC`;
  if (normalizedSort === 'updatedAt') return `updated_at ${direction}`;
  if (normalizedSort === 'rating') return `COALESCE(NULLIF(data->>'rating', '')::NUMERIC, 0) ${direction}, created_at DESC`;
  return `created_at ${direction}`;
}

async function fetchListings(options = {}) {
  if (!isAppDbEnabled()) return null;

  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.min(Math.max(1, parseInt(options.limit || 12, 10)), 60);
  const offset = (page - 1) * limit;
  const { where, params } = buildListingsWhere(options);
  const orderBy = resolveOrderBy(options.sortBy, options.sortOrder);

  const rowsSql = `
    SELECT *
    FROM public_listings
    WHERE ${where}
    ORDER BY ${orderBy}
    LIMIT ${appendParam(params, limit)}
    OFFSET ${appendParam(params, offset)}
  `;
  const countParams = params.slice(0, params.length - 2);
  const countSql = `SELECT COUNT(*)::INTEGER AS total FROM public_listings WHERE ${where}`;

  const [rowsResult, countResult] = await Promise.all([
    query(rowsSql, params),
    query(countSql, countParams)
  ]);

  const total = Number(countResult.rows?.[0]?.total || 0);
  return {
    success: true,
    data: rowsResult.rows.map(rowToListing),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: offset + rowsResult.rows.length < total
    },
    source: 'postgres'
  };
}

async function fetchListingBySlug(collectionName, slug) {
  if (!isAppDbEnabled()) return null;

  const result = await query(
    `SELECT *
     FROM public_listings
     WHERE collection_name = $1 AND slug = $2 AND status = 'active'
     LIMIT 1`,
    [normalizeCollectionName(collectionName), normalizeText(slug)]
  );
  return result.rows[0] ? rowToListing(result.rows[0]) : null;
}

async function fetchPublicListingById(collectionName, id) {
  if (!isAppDbEnabled()) return null;

  const result = await query(
    `SELECT *
     FROM public_listings
     WHERE collection_name = $1 AND id = $2
     LIMIT 1`,
    [normalizeCollectionName(collectionName), normalizeText(id)]
  );

  if (!result.rows[0]) return null;
  return {
    ...rowToListing(result.rows[0]),
    collectionName: result.rows[0].collection_name
  };
}

async function fetchSimilarListings({ collectionName, excludeId, propertyType, listingType, category, serviceType, limit = 3 }) {
  if (!isAppDbEnabled()) return [];

  const params = [normalizeCollectionName(collectionName), normalizeText(excludeId), Math.min(Math.max(1, Number(limit) || 3), 8)];
  const clauses = [`collection_name = $1`, `id <> $2`, `status = 'active'`];

  if (propertyType) {
    params.push(normalizeText(propertyType).toLowerCase());
    clauses.push(`property_type = $${params.length}`);
  }
  if (listingType) {
    params.push(normalizeListingType(listingType));
    clauses.push(`listing_type = $${params.length}`);
  }
  if (category) {
    params.push(normalizeText(category).toLowerCase());
    clauses.push(`lower(category) = $${params.length}`);
  }
  if (serviceType) {
    params.push(normalizeText(serviceType));
    clauses.push(`service_type = $${params.length}`);
  }

  const result = await query(
    `SELECT *
     FROM public_listings
     WHERE ${clauses.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT $3`,
    params
  );

  return result.rows.map(rowToListing);
}

async function fetchUserListings({ userId, collectionNames = VALID_COLLECTIONS, limit = 60 } = {}) {
  if (!isAppDbEnabled()) return null;

  const cleanUserId = normalizeText(userId);
  if (!cleanUserId) return [];

  const collections = Array.from(collectionNames)
    .map((collectionName) => normalizeText(collectionName))
    .filter((collectionName) => VALID_COLLECTIONS.has(collectionName));

  if (!collections.length) return [];

  const cappedLimit = Math.min(Math.max(1, Number(limit) || 60), 200);
  const result = await query(
    `SELECT *
     FROM public_listings
     WHERE user_id = $1
       AND collection_name = ANY($2::text[])
       AND status = 'active'
     ORDER BY
       COALESCE((data->>'isPromoted')::boolean, false) DESC,
       created_at DESC
     LIMIT $3`,
    [cleanUserId, collections, cappedLimit]
  );

  return result.rows.map((row) => ({
    ...rowToListing(row),
    collectionName: row.collection_name
  }));
}

async function countUserListings({ userId, collectionNames = VALID_COLLECTIONS } = {}) {
  if (!isAppDbEnabled()) return null;

  const cleanUserId = normalizeText(userId);
  if (!cleanUserId) return 0;

  const collections = Array.from(collectionNames)
    .map((collectionName) => normalizeText(collectionName))
    .filter((collectionName) => VALID_COLLECTIONS.has(collectionName));

  if (!collections.length) return 0;

  const result = await query(
    `SELECT COUNT(*)::INTEGER AS total
     FROM public_listings
     WHERE user_id = $1
       AND collection_name = ANY($2::text[])
       AND status = 'active'`,
    [cleanUserId, collections]
  );

  return Number(result.rows?.[0]?.total || 0);
}

async function upsertPublicListings(collectionName, items = []) {
  if (!isAppDbEnabled()) return { enabled: false, upserted: 0, skipped: items.length };

  const records = items
    .map((item) => buildPublicListingRecord(collectionName, item))
    .filter(Boolean);

  if (!records.length) {
    return { enabled: true, upserted: 0, skipped: items.length };
  }

  const sql = `
    INSERT INTO public_listings (
      collection_name, id, slug, title, description, location, price_text, price_numeric,
      listing_type, property_type, service_type, category, condition, status, image_urls,
      phone, whatsapp_number, agent_name, user_id, kyc_status, source, source_url, dedupe_key,
      is_scraped, bedrooms, bathrooms, toilets, size_value, size_unit, posted_at, created_at,
      updated_at, data
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12, $13, $14, $15,
      $16, $17, $18, $19, $20, $21, $22, $23,
      $24, $25, $26, $27, $28, $29, $30, $31,
      $32, $33::jsonb
    )
    ON CONFLICT (collection_name, id) DO UPDATE SET
      slug = EXCLUDED.slug,
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      location = EXCLUDED.location,
      price_text = EXCLUDED.price_text,
      price_numeric = EXCLUDED.price_numeric,
      listing_type = EXCLUDED.listing_type,
      property_type = EXCLUDED.property_type,
      service_type = EXCLUDED.service_type,
      category = EXCLUDED.category,
      condition = EXCLUDED.condition,
      status = EXCLUDED.status,
      image_urls = EXCLUDED.image_urls,
      phone = EXCLUDED.phone,
      whatsapp_number = EXCLUDED.whatsapp_number,
      agent_name = EXCLUDED.agent_name,
      user_id = EXCLUDED.user_id,
      kyc_status = EXCLUDED.kyc_status,
      source = EXCLUDED.source,
      source_url = EXCLUDED.source_url,
      dedupe_key = EXCLUDED.dedupe_key,
      is_scraped = EXCLUDED.is_scraped,
      bedrooms = EXCLUDED.bedrooms,
      bathrooms = EXCLUDED.bathrooms,
      toilets = EXCLUDED.toilets,
      size_value = EXCLUDED.size_value,
      size_unit = EXCLUDED.size_unit,
      posted_at = EXCLUDED.posted_at,
      updated_at = EXCLUDED.updated_at,
      data = EXCLUDED.data
  `;

  for (const record of records) {
    const uniqueSlug = await resolveUniqueSlug(record);
    const recordToSave = applyResolvedSlug(record, uniqueSlug);

    await query(sql, [
      recordToSave.collectionName,
      recordToSave.id,
      recordToSave.slug,
      recordToSave.title,
      recordToSave.description,
      recordToSave.location,
      recordToSave.priceText,
      recordToSave.priceNumeric,
      recordToSave.listingType,
      recordToSave.propertyType,
      recordToSave.serviceType,
      recordToSave.category,
      recordToSave.condition,
      recordToSave.status,
      recordToSave.imageUrls,
      recordToSave.phone,
      recordToSave.whatsappNumber,
      recordToSave.agentName,
      recordToSave.userId,
      recordToSave.kycStatus,
      recordToSave.source,
      recordToSave.sourceUrl,
      recordToSave.dedupeKey,
      recordToSave.isScraped,
      recordToSave.bedrooms,
      recordToSave.bathrooms,
      recordToSave.toilets,
      recordToSave.sizeValue,
      recordToSave.sizeUnit,
      recordToSave.postedAt,
      recordToSave.createdAt,
      recordToSave.updatedAt,
      recordToSave.data
    ]);
  }

  return { enabled: true, upserted: records.length, skipped: items.length - records.length };
}

async function getHealthSummary() {
  if (!isAppDbEnabled()) {
    return { enabled: false };
  }

  const result = await query(`
    SELECT collection_name, COUNT(*)::INTEGER AS total
    FROM public_listings
    GROUP BY collection_name
    ORDER BY collection_name
  `);
  return {
    enabled: true,
    listings: result.rows
  };
}

async function deletePublicListing(collectionName, id) {
  if (!isAppDbEnabled()) return { enabled: false, deleted: 0 };
  if (!collectionName || !id) return { enabled: true, deleted: 0 };

  const result = await query(
    `DELETE FROM public_listings
     WHERE collection_name = $1
       AND id = $2`,
    [String(collectionName), String(id)]
  );

  return { enabled: true, deleted: result.rowCount || 0 };
}

// Used by the S3 image-delete routes to verify a user owns the listing an
// image URL is attached to, across all 5 listing types in one query.
async function hasOwnedListingImage(userId, imageUrl) {
  if (!isAppDbEnabled() || !userId || !imageUrl) return false;

  const result = await query(
    `SELECT 1 FROM public_listings
     WHERE user_id = $1 AND $2 = ANY(image_urls)
     LIMIT 1`,
    [normalizeText(userId), normalizeText(imageUrl)]
  );

  return result.rows.length > 0;
}

module.exports = {
  buildPublicListingRecord,
  countUserListings,
  deletePublicListing,
  fetchListingBySlug,
  fetchPublicListingById,
  fetchListings,
  fetchSimilarListings,
  fetchUserListings,
  getHealthSummary,
  hasOwnedListingImage,
  isAppDbEnabled,
  normalizeListingType,
  rowToListing,
  upsertPublicListings
};
