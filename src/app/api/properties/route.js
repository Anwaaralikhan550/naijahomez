export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuth } from 'firebase-admin/auth';
import { getAdminFirestore } from '@/lib/firebase-admin';
import cache, { cacheKeys } from '@/lib/cache';
import { generateDocumentSlug } from '@/utils/slugify';
import logger from '@/lib/logger';
import { fixListingEncoding } from '@/utils/fixEncoding';
import { normalizeImageFields } from '@/lib/hubFirestore';
import { validateListingStringLengths, buildLengthExceededErrorMessage } from '@/lib/listingLengthValidation';
import { getUserTrustFields } from '@/lib/kyc/kyc-service';
import descriptionGenerator from '@/lib/scrapers/listing-description-generator';
import listingRepository from '@/lib/db/listing-repository.cjs';
import path from 'path';
import { promises as fs } from 'fs';

const PROPERTY_FALLBACK_CACHE_PATH = process.env.PROPERTY_FALLBACK_CACHE_PATH ||
  path.join(process.cwd(), 'data', 'properties-fallback.json');
const { withPublicSafeDescription } = descriptionGenerator?.default || descriptionGenerator;
const { fetchListings, isAppDbEnabled, upsertPublicListings } = listingRepository;

function normalizeListingType(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-');

  if (!normalized) return '';
  if (normalized === 'rent' || normalized === 'for-rent' || normalized === 'forrent') return 'rent';
  if (normalized === 'sale' || normalized === 'for-sale' || normalized === 'forsale') return 'sale';
  return '';
}

function parsePriceValue(value) {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const raw = String(value).trim().toLowerCase();
  if (!raw) return null;

  const compact = raw.replace(/,/g, '');
  const shortMatch = compact.match(/(\d+(?:\.\d+)?)\s*([mk])/i);
  if (shortMatch) {
    const base = parseFloat(shortMatch[1]);
    if (!Number.isNaN(base)) {
      const multiplier = shortMatch[2].toLowerCase() === 'm' ? 1000000 : 1000;
      return base * multiplier;
    }
  }

  const cleaned = compact.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;

  const parsed = parseFloat(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
}

function getPropertyPriceNumeric(property) {
  return (
    parsePriceValue(property?.priceNumeric) ??
    parsePriceValue(property?.saleDetails?.price) ??
    parsePriceValue(property?.rentAmount?.monthly) ??
    parsePriceValue(property?.rentAmount?.annual) ??
    parsePriceValue(property?.rentAmount) ??
    parsePriceValue(property?.price) ??
    null
  );
}

function inferListingType(property) {
  const explicit = normalizeListingType(property?.listingType);
  if (explicit) return explicit;

  if (property?.saleDetails?.price || property?.saleDetails?.titleDocument) {
    return 'sale';
  }

  if (property?.rentAmount?.monthly || property?.rentAmount?.annual || property?.rentAmount) {
    return 'rent';
  }

  const haystack = [
    property?.price,
    property?.rate,
    property?.title,
    property?.description,
    property?.category,
    property?.propertyCategory,
    property?.type
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (!haystack) return '';

  const rentKeywords = [
    '/month',
    '/year',
    '/annum',
    'per month',
    'per year',
    'per annum',
    'monthly',
    'annually',
    'yearly',
    'rent',
    'rental',
    'to let',
    'lease'
  ];

  if (rentKeywords.some((keyword) => haystack.includes(keyword))) {
    return 'rent';
  }

  const saleKeywords = [
    'for sale',
    'sale',
    'buy',
    'purchase',
    'selling',
    'title document',
    'deed',
    'c of o',
    'certificate of occupancy'
  ];

  if (saleKeywords.some((keyword) => haystack.includes(keyword))) {
    return 'sale';
  }

  // If a property has a plain one-off price and no rent wording, it is usually a sale listing.
  return getPropertyPriceNumeric(property) ? 'sale' : '';
}

const errorResponse = (message, code, status = 500) =>
  NextResponse.json({ success: false, error: message, code }, { status });

const authErrorResponse = async (authError) => {
  const status = authError?.status || 401;
  const payload = await authError?.clone?.().json?.().catch(() => ({}));
  const rawMessage = payload?.error;
  const message = (typeof rawMessage === 'string' && rawMessage) || rawMessage?.message || 'Authentication required';
  const code = status === 403 ? 'FORBIDDEN' : status === 503 ? 'AUTH_SERVICE_UNAVAILABLE' : 'UNAUTHORIZED';
  return errorResponse(message, code, status);
};

function isQuotaExceededError(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === 8 || message.includes('resource_exhausted') || message.includes('quota exceeded');
}

async function readPropertyFallbackCache() {
  try {
    const raw = await fs.readFile(PROPERTY_FALLBACK_CACHE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const data = Array.isArray(parsed?.data) ? parsed.data : [];
    return {
      generatedAt: parsed?.generatedAt || null,
      data: data.map((item) => withPublicSafeDescription(fixListingEncoding(normalizeImageFields(item))))
    };
  } catch {
    return { generatedAt: null, data: [] };
  }
}

function buildPropertyListResponse(properties, params, options = {}) {
  const {
    page,
    limit,
    search,
    minPrice,
    maxPrice,
    bedrooms,
    bathrooms,
    location,
    propertyType,
    listingType,
    sortBy,
    sortOrder
  } = params;

  let filteredProperties = properties.filter((property) => {
    const normalizedStatus = typeof property.status === 'string' ? property.status.trim().toLowerCase() : '';
    const imageCount = Array.isArray(property.imageUrls) ? property.imageUrls.length : 0;
    const propertyListingType = inferListingType(property);
    const propertyPrice = getPropertyPriceNumeric(property);
    const minPriceValue = parsePriceValue(minPrice);
    const maxPriceValue = parsePriceValue(maxPrice);

    const matchesStatus = normalizedStatus === 'active';
    const matchesImageCount = imageCount > 0;
    const matchesSearch = !search ||
      property.title?.toLowerCase().includes(search.toLowerCase()) ||
      property.description?.toLowerCase().includes(search.toLowerCase());
    const matchesLocation = !location ||
      property.location?.toLowerCase().includes(location.toLowerCase());
    const matchesPropertyType = !propertyType ||
      property.propertyType === propertyType;
    const matchesListingType = !listingType || propertyListingType === listingType;
    const matchesMinPrice = minPriceValue === null || (propertyPrice !== null && propertyPrice >= minPriceValue);
    const matchesMaxPrice = maxPriceValue === null || (propertyPrice !== null && propertyPrice <= maxPriceValue);
    const matchesBedrooms = !bedrooms || property.bedrooms == parseInt(bedrooms);
    const matchesBathrooms = !bathrooms || property.bathrooms == parseInt(bathrooms);

    return matchesStatus && matchesImageCount &&
      matchesSearch && matchesLocation && matchesPropertyType && matchesListingType &&
      matchesMinPrice && matchesMaxPrice && matchesBedrooms && matchesBathrooms;
  });

  filteredProperties.sort((a, b) => {
    if (sortBy === 'createdAt') {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return sortOrder === 'desc' ? bTime - aTime : aTime - bTime;
    }
    if (sortBy === 'priceNumeric' || sortBy === 'price') {
      const aPrice = a.priceNumeric || 0;
      const bPrice = b.priceNumeric || 0;
      return sortOrder === 'desc' ? bPrice - aPrice : aPrice - bPrice;
    }
    return 0;
  });

  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedProperties = filteredProperties.slice(startIndex, endIndex);

  return {
    success: true,
    data: paginatedProperties,
    pagination: {
      page,
      limit,
      total: filteredProperties.length,
      totalPages: Math.ceil(filteredProperties.length / limit),
      hasMore: endIndex < filteredProperties.length || Boolean(options.reachedFetchLimit)
    },
    ...(options.fallback ? {
      fallback: true,
      stale: true,
      generatedAt: options.generatedAt || null
    } : {})
  };
}

// GET - Fetch properties with efficient server-side filtering
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Extract query parameters
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');
    const search = searchParams.get('search') || '';
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const bedrooms = searchParams.get('bedrooms');
    const bathrooms = searchParams.get('bathrooms');
    const location = searchParams.get('location');
    const propertyType = searchParams.get('propertyType');
    const rawListingType = searchParams.get('listingType') || searchParams.get('type');
    const listingType = normalizeListingType(rawListingType);
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    
    // Create cache key from parameters
    const cacheParams = {
      page, limit, search, minPrice, maxPrice, bedrooms, bathrooms,
      location, propertyType, listingType, sortBy, sortOrder
    };
    
    const cacheKey = cacheKeys.properties(cacheParams);
    
    // Check cache first
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
      return NextResponse.json(cachedResult);
    }

    if (isAppDbEnabled()) {
      try {
        const postgresResult = await fetchListings({
          collectionName: 'properties',
          page,
          limit,
          search,
          minPrice,
          maxPrice,
          location,
          sortBy,
          sortOrder,
          filters: {
            bedrooms,
            bathrooms,
            propertyType,
            listingType
          }
        });

        if (postgresResult?.pagination?.total > 0 || process.env.POSTGRES_ALLOW_EMPTY_RESULTS === 'true') {
          postgresResult.data = postgresResult.data.map((item) =>
            withPublicSafeDescription(fixListingEncoding(normalizeImageFields(item)))
          );
          cache.set(cacheKey, postgresResult, 30000);
          return NextResponse.json(postgresResult);
        }
      } catch (postgresError) {
        logger.warn('PostgreSQL properties query failed, falling back to Firestore', postgresError);
      }
    }
    
    // Get Admin Firestore
    const db = getAdminFirestore();

    // Build base query
    let baseQuery = db.collection('properties');

    // Do not filter listingType at Firestore level. Older/imported records may not
    // have a normalized listingType field, so we infer rent/sale after fetching.

    // Keep reads small. Firestore free-tier quota can be exhausted quickly if
    // every public page request scans hundreds of docs.
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const hasUserFilters = Boolean(search || location || propertyType || listingType || minPrice || maxPrice || bedrooms || bathrooms);
    const fetchLimit = hasUserFilters
      ? Math.min(Math.max(safeLimit * 3, 36), 90)
      : safeLimit;

    let fetchedDocs = [];
    let reachedFetchLimit = false;

    const snapshot = await baseQuery
      .orderBy('createdAt', 'desc')
      .limit(fetchLimit)
      .get();

    fetchedDocs = snapshot.docs;
    reachedFetchLimit = snapshot.docs.length >= fetchLimit;

    console.log(`Raw properties fetched: ${fetchedDocs.length}`);

    // Process results
    let properties = [];
    fetchedDocs.forEach(doc => {
      const data = doc.data();
      properties.push(withPublicSafeDescription(fixListingEncoding(normalizeImageFields({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt || null
      }))));
    });

    const result = buildPropertyListResponse(properties, {
      page, limit, search, minPrice, maxPrice, bedrooms, bathrooms,
      location, propertyType, listingType, sortBy, sortOrder
    }, { reachedFetchLimit });
    
    // Cache the result for 30 seconds during development
    cache.set(cacheKey, result, 30000);
    
    return NextResponse.json(result);
    
  } catch (error) {
    logger.error('Error fetching properties', error);
    if (isQuotaExceededError(error)) {
      const fallbackCache = await readPropertyFallbackCache();
      if (fallbackCache.data.length > 0) {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '12');
        const result = buildPropertyListResponse(fallbackCache.data, {
          page,
          limit,
          search: searchParams.get('search') || '',
          minPrice: searchParams.get('minPrice'),
          maxPrice: searchParams.get('maxPrice'),
          bedrooms: searchParams.get('bedrooms'),
          bathrooms: searchParams.get('bathrooms'),
          location: searchParams.get('location'),
          propertyType: searchParams.get('propertyType'),
          listingType: normalizeListingType(searchParams.get('listingType') || searchParams.get('type')),
          sortBy: searchParams.get('sortBy') || 'createdAt',
          sortOrder: searchParams.get('sortOrder') || 'desc'
        }, { fallback: true, generatedAt: fallbackCache.generatedAt });
        return NextResponse.json(result);
      }
    }
    return errorResponse('Failed to fetch properties', 'PROPERTIES_FETCH_FAILED', 500);
  }
}

// POST - Create a new property (authenticated)
export async function POST(request) {
  try {
    // Verify authentication using the auth middleware
    const authResult = await import('@/lib/auth-middleware').then(m => m.verifyAuth(request));
    
    if (!authResult.success) {
      return authErrorResponse(authResult.error);
    }

    const userId = authResult.userId;

    const data = await request.json();
    const normalizedInput = normalizeImageFields(data);
    const normalizedImageUrls = Array.isArray(normalizedInput.imageUrls)
      ? normalizedInput.imageUrls.map((item) => String(item || '').trim()).filter(Boolean)
      : [];

    const lengthValidation = validateListingStringLengths(data);
    if (!lengthValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: buildLengthExceededErrorMessage(lengthValidation),
          code: 'VALIDATION_LENGTH_EXCEEDED',
          field: lengthValidation.field,
          maxLength: lengthValidation.maxLength,
          actualLength: lengthValidation.actualLength
        },
        { status: 400 }
      );
    }
    
    // Validate required fields
    if (!data.title || !data.location || !data.price) {
      return errorResponse('Missing required fields', 'VALIDATION_ERROR', 400);
    }

    if (normalizedImageUrls.length < 1) {
      return errorResponse('At least one image is required to post an ad.', 'VALIDATION_ERROR', 400);
    }
    
    // Use admin Firestore
    const db = getAdminFirestore();
    const userTrustFields = await getUserTrustFields(db, userId);
    const docRef = db.collection('properties').doc();
    
    // Generate unique slug using document ID
    const uniqueSlug = generateDocumentSlug(data.title, docRef.id);
    
    // Prepare property data
    const propertyData = {
      ...normalizedInput,
      ...userTrustFields,
      imageUrls: normalizedImageUrls,
      userId,
      slug: uniqueSlug,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      titleLower: data.title.toLowerCase(),
      locationLower: data.location.toLowerCase(),
      priceNumeric: parseFloat(String(data.price).replace(/[^0-9.]/g, '')) || 0
    };
    
    // Infer listing type if not provided
    if (!propertyData.listingType && propertyData.price) {
      const priceString = String(propertyData.price).toLowerCase();
      const rentKeywords = ['/month', '/year', 'per month', 'per year', 'per annum'];
      propertyData.listingType = rentKeywords.some(keyword => priceString.includes(keyword)) ? 'rent' : 'sale';
    }
    
    await docRef.set(propertyData);

    if (isAppDbEnabled()) {
      try {
        await upsertPublicListings('properties', [{ id: docRef.id, ...propertyData }]);
      } catch (postgresError) {
        logger.warn('Failed to sync created property to PostgreSQL', postgresError);
      }
    }
    
    return NextResponse.json({
      success: true,
      id: docRef.id,
      data: propertyData
    });
    
  } catch (error) {
    logger.error('Error creating property', error);
    return errorResponse('Failed to create property', 'PROPERTY_CREATE_FAILED', 500);
  }
}
