export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuth } from 'firebase-admin/auth';
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

const HOUSEMATE_COLLECTIONS = ['housemates', 'housemate'];

const toIsoString = (value) => value?.toDate?.()?.toISOString() || null;

const numericValue = (value) => {
  if (typeof value === 'number') return value;
  return parseFloat(String(value || '').replace(/[^0-9.]/g, '')) || 0;
};

const dateValue = (value) => {
  if (!value) return 0;
  if (value?.toDate && typeof value.toDate === 'function') return value.toDate().getTime();
  if (value?.seconds) return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const normalizeSlug = (data, id) => data.slug || id;

function isQuotaExceededError(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === 8 || message.includes('resource_exhausted') || message.includes('quota exceeded');
}

const mapHousemateDoc = (doc, collectionName) => {
  const data = doc.data();
  return normalizeImageFields({
    id: doc.id,
    collectionName,
    ...data,
    slug: normalizeSlug(data, doc.id),
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt)
  });
};

const fetchHousematesFromCollection = async ({
  db,
  collectionName,
  gender,
  roomType,
  advertType,
  tags,
  fetchLimit
}) => {
  let query = db.collection(collectionName)
    .where('status', '==', 'active');

  if (gender) {
    query = query.where('gender', '==', gender);
  }

  if (roomType) {
    query = query.where('roomType', '==', roomType);
  }

  if (advertType) {
    query = query.where('advertType', '==', advertType);
  }

  if (tags.length > 0) {
    query = query.where('tags', 'array-contains-any', tags.slice(0, 10));
  }

  query = query.orderBy('createdAt', 'desc').limit(fetchLimit);

  try {
    return await query.get();
  } catch (queryError) {
    logger.warn(`Housemates query fallback triggered for ${collectionName}`, queryError);
    return db.collection(collectionName)
      .where('status', '==', 'active')
      .orderBy('createdAt', 'desc')
      .limit(fetchLimit)
      .get();
  }
};

const authErrorResponse = async (authError) => {
  const status = authError?.status || 401;
  const payload = await authError?.clone?.().json?.().catch(() => ({}));
  const rawMessage = payload?.error;
  const message = (typeof rawMessage === 'string' && rawMessage) || rawMessage?.message || 'Authentication required';
  const code = status === 403 ? 'FORBIDDEN' : status === 503 ? 'AUTH_SERVICE_UNAVAILABLE' : 'UNAUTHORIZED';
  return errorResponse(message, code, status);
};

// GET - Fetch housemates with efficient server-side filtering
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Extract query parameters
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');
    const search = searchParams.get('search') || '';
    const minBudget = searchParams.get('minBudget');
    const maxBudget = searchParams.get('maxBudget');
    const gender = searchParams.get('gender');
    const location = searchParams.get('location');
    const roomType = searchParams.get('roomType');
    const advertType = searchParams.get('advertType');
    const tags = (searchParams.get('tags') || searchParams.get('tag') || '')
      .split(',')
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean);
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    
    // Create cache key from parameters
    const cacheParams = {
      page, limit, search, minBudget, maxBudget, gender,
      location, roomType, advertType, sortBy, sortOrder, tags: tags.join(',')
    };
    
    const cacheKey = cacheKeys.housemates(cacheParams);
    
    // Check cache first
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
      return NextResponse.json(cachedResult);
    }

    if (isAppDbEnabled()) {
      try {
        const postgresResult = await fetchListings({
          collectionName: 'housemates',
          page,
          limit,
          search,
          minPrice: minBudget,
          maxPrice: maxBudget,
          location,
          sortBy,
          sortOrder,
          filters: {
            tags,
            gender,
            roomType,
            advertType
          }
        });

        if (postgresResult?.pagination?.total > 0 || process.env.POSTGRES_ALLOW_EMPTY_RESULTS === 'true') {
          postgresResult.data = postgresResult.data.map((listing) => normalizeImageFields(listing));
          cache.set(cacheKey, postgresResult, 300000);
          return NextResponse.json(postgresResult);
        }
      } catch (postgresError) {
        logger.warn('PostgreSQL housemates query failed, falling back to Firestore', postgresError);
      }
    }
    
    // Initialize admin SDK
    const db = getAdminFirestore();

    const hasExactFilters = Boolean(gender || roomType || advertType || tags.length > 0);
    const fetchLimit = Math.min(Math.max(limit * (hasExactFilters ? 6 : 8), hasExactFilters ? 60 : 80), hasExactFilters ? 240 : 500);

    const snapshots = await Promise.all(
      HOUSEMATE_COLLECTIONS.map((collectionName) =>
        fetchHousematesFromCollection({
          db,
          collectionName,
          gender,
          roomType,
          advertType,
          tags,
          fetchLimit
        }).then((snapshot) => ({ collectionName, snapshot }))
      )
    );
    
    // Process results from both legacy singular and current plural collections.
    let housemates = [];
    const seen = new Set();
    snapshots.forEach(({ collectionName, snapshot }) => {
      snapshot.forEach(doc => {
        const key = `${collectionName}:${doc.id}`;
        if (seen.has(key)) return;
        seen.add(key);
        housemates.push(mapHousemateDoc(doc, collectionName));
      });
    });
    
    // Apply filters BEFORE pagination
    const minBudgetValue = minBudget ? parseFloat(minBudget) : null;
    const maxBudgetValue = maxBudget ? parseFloat(maxBudget) : null;
    const filteredHousemates = housemates.filter((housemate) => {
      const normalizedTitle = housemate.title?.toLowerCase() || '';
      const normalizedDescription = housemate.description?.toLowerCase() || '';
      const normalizedName = housemate.name?.toLowerCase() || '';
      const normalizedLocation = housemate.location?.toLowerCase() || '';
      const normalizedGender = housemate.gender?.toLowerCase() || '';
      const normalizedRoomType = housemate.roomType?.toLowerCase() || '';
      const normalizedAdvertType = housemate.advertType?.toLowerCase() || '';

      const budgetNumeric = typeof housemate.budgetNumeric === 'number'
        ? housemate.budgetNumeric
        : parseFloat(String(housemate.budget || housemate.budgetRange || '').replace(/[^0-9.]/g, '')) || 0;

      const itemTags = Array.isArray(housemate.tags)
        ? housemate.tags.map((tag) => String(tag).toLowerCase())
        : [];

      const normalizedStatus = typeof housemate.status === 'string' ? housemate.status.trim().toLowerCase() : '';
      const matchesStatus = normalizedStatus === 'active';

      const matchesSearch = !search ||
        normalizedTitle.includes(search.toLowerCase()) ||
        normalizedDescription.includes(search.toLowerCase()) ||
        normalizedName.includes(search.toLowerCase());

      const matchesLocation = !location || normalizedLocation.includes(location.toLowerCase());
      const matchesGender = !gender || normalizedGender === gender.toLowerCase();
      const matchesRoomType = !roomType || normalizedRoomType === roomType.toLowerCase();
      const matchesAdvertType = !advertType || normalizedAdvertType === advertType.toLowerCase();
      const matchesMinBudget = minBudgetValue === null || budgetNumeric >= minBudgetValue;
      const matchesMaxBudget = maxBudgetValue === null || budgetNumeric <= maxBudgetValue;
      const matchesTags = tags.length === 0 || tags.some((tag) => itemTags.includes(tag));

      return matchesStatus &&
        matchesSearch &&
        matchesLocation &&
        matchesGender &&
        matchesRoomType &&
        matchesAdvertType &&
        matchesMinBudget &&
        matchesMaxBudget &&
        matchesTags;
    });

    // Pagination AFTER filtering
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    filteredHousemates.sort((a, b) => {
      let aValue;
      let bValue;

      if (sortBy === 'price' || sortBy === 'budget' || sortBy === 'budgetNumeric') {
        aValue = numericValue(a.budgetNumeric || a.budget || a.budgetRange || a.price || a.rate);
        bValue = numericValue(b.budgetNumeric || b.budget || b.budgetRange || b.price || b.rate);
      } else {
        aValue = dateValue(a.createdAt);
        bValue = dateValue(b.createdAt);
      }

      if (aValue === bValue) return 0;
      return aValue > bValue ? sortDirection : -sortDirection;
    });

    const totalCount = filteredHousemates.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedHousemates = filteredHousemates.slice(startIndex, endIndex);
    const hasMore = endIndex < totalCount;
    
    const result = {
      success: true,
      data: paginatedHousemates,
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
    logger.error('Error fetching housemates', error);
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
    return errorResponse('Failed to fetch housemates', 'HOUSEMATES_FETCH_FAILED', 500);
  }
}

// POST - Create a new housemate listing (authenticated)
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
    if (!data.title || !data.location) {
      return errorResponse('Missing required fields', 'VALIDATION_ERROR', 400);
    }
    
    const db = getAdminFirestore();
    const userTrustFields = await getUserTrustFields(db, userId);

    const id = isAppDbEnabled() ? randomUUID() : db.collection('housemates').doc().id;
    const slug = `${data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${id.slice(-6)}`;

    // Prepare housemate data
    const housemateData = {
      ...data,
      ...userTrustFields,
      userId,
      slug,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      titleLower: data.title.toLowerCase(),
      locationLower: data.location.toLowerCase(),
      budgetNumeric: parseFloat(String(data.budget || data.budgetRange || '0').replace(/[^0-9.]/g, '')) || 0
    };

    if (isAppDbEnabled()) {
      const result = await upsertPublicListings('housemates', [{ id, ...housemateData }]);
      if (!result?.upserted) {
        throw new Error('Failed to save housemate listing to database');
      }
    } else {
      await db.collection('housemates').doc(id).set(housemateData);
    }

    return NextResponse.json({
      success: true,
      id,
      data: housemateData
    });
    
  } catch (error) {
    logger.error('Error creating housemate listing', error);
    return errorResponse('Failed to create housemate listing', 'HOUSEMATE_CREATE_FAILED', 500);
  }
}
