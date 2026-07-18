export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import cache, { cacheKeys } from '@/lib/cache';
import { verifyAuth, isAdmin } from '@/lib/auth-middleware';
import logger from '@/lib/logger';
import { normalizeImageFields } from '@/lib/hubFirestore';
import { validateListingStringLengths, buildLengthExceededErrorMessage } from '@/lib/listingLengthValidation';
import { getUserTrustFields } from '@/lib/kyc/kyc-service';
import listingRepository from '@/lib/db/listing-repository.cjs';
import { randomUUID } from 'crypto';

const errorResponse = (message, code, status = 500) =>
  NextResponse.json({ success: false, error: message, code }, { status });
const { fetchListings, isAppDbEnabled, upsertPublicListings } = listingRepository;

function isQuotaExceededError(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === 8 || message.includes('resource_exhausted') || message.includes('quota exceeded');
}

const authErrorResponse = async (authError) => {
  const status = authError?.status || 401;
  const payload = await authError?.clone?.().json?.().catch(() => ({}));
  const rawMessage = payload?.error;
  const message = (typeof rawMessage === 'string' && rawMessage) || rawMessage?.message || 'Authentication required';
  const code = status === 403 ? 'FORBIDDEN' : status === 503 ? 'AUTH_SERVICE_UNAVAILABLE' : 'UNAUTHORIZED';
  return errorResponse(message, code, status);
};

// GET - Fetch marketplace items with efficient server-side filtering
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Extract query parameters
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');
    const search = searchParams.get('search') || '';
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const condition = searchParams.get('condition');
    const category = searchParams.get('category');
    const paymentType = searchParams.get('paymentType');
    const collectionType = searchParams.get('collectionType');
    const location = searchParams.get('location');
    const communityId = searchParams.get('communityId');
    const tags = (searchParams.get('tags') || searchParams.get('tag') || '')
      .split(',')
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean);
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    
    // Create cache key from parameters
    const cacheParams = {
      page, limit, search, minPrice, maxPrice, condition, category,
      paymentType, collectionType, location, sortBy, sortOrder, communityId, tags: tags.join(',')
    };
    
    const cacheKey = cacheKeys.marketplace(cacheParams);
    
    // Check cache first
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
      return NextResponse.json(cachedResult);
    }

    if (isAppDbEnabled()) {
      try {
        const postgresResult = await fetchListings({
          collectionName: 'marketplace',
          page,
          limit,
          search,
          minPrice,
          maxPrice,
          location,
          sortBy,
          sortOrder,
          filters: {
            condition,
            category,
            paymentType,
            collectionType,
            communityId,
            tags
          }
        });

        if (postgresResult?.pagination?.total > 0 || process.env.POSTGRES_ALLOW_EMPTY_RESULTS === 'true') {
          postgresResult.data = postgresResult.data.map((item) => normalizeImageFields(item));
          cache.set(cacheKey, postgresResult, 300000);
          return NextResponse.json(postgresResult);
        }
      } catch (postgresError) {
        logger.warn('PostgreSQL marketplace query failed, falling back to Firestore', postgresError);
      }
    }
    
    // Initialize admin SDK
    const db = getAdminFirestore();
    
    // Keep query window bounded for low-latency responses.
    const fetchLimit = Math.min(Math.max(limit * 8, 60), 200);

    // Simple query - only filter by status and sort
    let query = db.collection('marketplace')
      .where('status', '==', 'active')
      .orderBy('createdAt', 'desc')
      .limit(fetchLimit);
    
    // Execute query
    const snapshot = await query.get();
    
    // Process results
    let items = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      items.push(normalizeImageFields({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null
      }));
    });

    // Apply filters BEFORE pagination
    const minPriceValue = minPrice ? parseFloat(minPrice) : null;
    const maxPriceValue = maxPrice ? parseFloat(maxPrice) : null;
    const filteredItems = items.filter((item) => {
      const normalizedTitle = item.title?.toLowerCase() || '';
      const normalizedDescription = item.description?.toLowerCase() || '';
      const normalizedLocation = item.location?.toLowerCase() || '';
      const normalizedCategory = item.category?.toLowerCase() || '';
      const normalizedSubcategory = item.subcategory?.toLowerCase() || '';
      const normalizedPaymentType = item.paymentType?.toLowerCase() || '';
      const normalizedCollectionType = item.collectionType?.toLowerCase() || '';
      const normalizedCategorySlug = normalizedCategory
        .replace(/[\s&]+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
      const normalizedCondition = item.condition?.toLowerCase() || '';

      const priceNumeric = typeof item.priceNumeric === 'number'
        ? item.priceNumeric
        : parseFloat(String(item.price || item.priceString || '').replace(/[^0-9.]/g, '')) || 0;

      const itemTags = Array.isArray(item.tags)
        ? item.tags.map((tag) => String(tag).toLowerCase())
        : [];

      const matchesSearch = !search ||
        normalizedTitle.includes(search.toLowerCase()) ||
        normalizedDescription.includes(search.toLowerCase());

      const matchesLocation = !location || normalizedLocation.includes(location.toLowerCase());
      const matchesCommunity = !communityId || item.communityId === communityId;

      const matchesCategory = !category ||
        normalizedCategory === category.toLowerCase() ||
        normalizedSubcategory === category.toLowerCase() ||
        normalizedCategorySlug === category.toLowerCase();

      const matchesCondition = !condition || normalizedCondition === condition.toLowerCase();
      const matchesPaymentType = !paymentType || normalizedPaymentType === paymentType.toLowerCase();
      const matchesCollectionType = !collectionType || normalizedCollectionType === collectionType.toLowerCase();

      const matchesMinPrice = minPriceValue === null || priceNumeric >= minPriceValue;
      const matchesMaxPrice = maxPriceValue === null || priceNumeric <= maxPriceValue;

      const matchesTags = tags.length === 0 || tags.some((tag) => itemTags.includes(tag));

      return matchesSearch &&
        matchesLocation &&
        matchesCommunity &&
        matchesCategory &&
        matchesCondition &&
        matchesPaymentType &&
        matchesCollectionType &&
        matchesMinPrice &&
        matchesMaxPrice &&
        matchesTags;
    });

    // Pagination AFTER filtering
    const totalCount = filteredItems.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedItems = filteredItems.slice(startIndex, endIndex);
    const hasMore = endIndex < totalCount;
    
    const result = {
      success: true,
      data: paginatedItems,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore
      }
    };
    
    // Cache the result for 5 minutes
    cache.set(cacheKey, result, 300000);
    
    return NextResponse.json(result);
    
  } catch (error) {
    logger.error('Error fetching marketplace items', error);
    if (isQuotaExceededError(error)) {
      const { searchParams } = new URL(request.url);
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '12');
      return NextResponse.json({
        success: true,
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasMore: false
        },
        fallback: true,
        quotaLimited: true
      });
    }
    return errorResponse('Failed to fetch marketplace items', 'MARKETPLACE_FETCH_FAILED', 500);
  }
}

// POST - Create a new marketplace item (authenticated)
export async function POST(request) {
  try {
    // Verify authentication using the auth middleware
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authErrorResponse(authResult.error);
    }

    const userId = authResult.userId;

    const data = await request.json();

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
    
    const db = getAdminFirestore();
    const userTrustFields = await getUserTrustFields(db, userId);

    const id = isAppDbEnabled() ? randomUUID() : db.collection('marketplace').doc().id;
    const slug = `${data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${id.slice(-6)}`;

    // Prepare marketplace item data
    const itemData = {
      ...normalizeImageFields(data),
      ...userTrustFields,
      userId,
      slug,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      titleLower: data.title.toLowerCase(),
      locationLower: data.location.toLowerCase(),
      priceNumeric: parseFloat(String(data.price).replace(/[^0-9.]/g, '')) || 0
    };

    if (isAppDbEnabled()) {
      const result = await upsertPublicListings('marketplace', [{ id, ...itemData }]);
      if (!result?.upserted) {
        throw new Error('Failed to save marketplace item to database');
      }
    } else {
      await db.collection('marketplace').doc(id).set(itemData);
    }

    return NextResponse.json({
      success: true,
      id,
      data: itemData
    });
    
  } catch (error) {
    logger.error('Error creating marketplace item', error);
    return errorResponse('Failed to create marketplace item', 'MARKETPLACE_CREATE_FAILED', 500);
  }
}
