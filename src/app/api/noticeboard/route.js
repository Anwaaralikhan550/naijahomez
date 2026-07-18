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

// GET - Fetch noticeboard items with efficient server-side filtering
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Extract query parameters
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');
    const search = searchParams.get('search') || '';
    const noticeType = searchParams.get('noticeType');
    const category = searchParams.get('category') || noticeType;
    const priority = searchParams.get('priority');
    const location = searchParams.get('location');
    const tags = (searchParams.get('tags') || searchParams.get('tag') || '')
      .split(',')
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean);
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    
    // Create cache key from parameters
    const cacheParams = {
      page, limit, search, category, priority, location, sortBy, sortOrder, tags: tags.join(',')
    };
    
    const cacheKey = cacheKeys.noticeboard(cacheParams);
    
    // Check cache first
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
      return NextResponse.json(cachedResult);
    }

    if (isAppDbEnabled()) {
      try {
        const postgresResult = await fetchListings({
          collectionName: 'noticeboard',
          page,
          limit,
          search,
          location,
          sortBy,
          sortOrder,
          filters: {
            category,
            tags
          }
        });

        if (postgresResult?.pagination?.total > 0 || process.env.POSTGRES_ALLOW_EMPTY_RESULTS === 'true') {
          postgresResult.data = postgresResult.data.map((notice) => normalizeImageFields(notice));
          cache.set(cacheKey, postgresResult, 180000);
          return NextResponse.json(postgresResult);
        }
      } catch (postgresError) {
        logger.warn('PostgreSQL noticeboard query failed, falling back to Firestore', postgresError);
      }
    }
    
    // Initialize admin SDK
    const db = getAdminFirestore();

    const hasExactFilters = Boolean(category || priority || tags.length > 0);
    const fetchLimit = Math.min(Math.max(limit * (hasExactFilters ? 6 : 8), hasExactFilters ? 60 : 80), hasExactFilters ? 240 : 500);

    let query = db.collection('noticeboard')
      .where('status', '==', 'active');

    if (category) {
      query = query.where('category', '==', category);
    }

    if (priority) {
      query = query.where('priority', '==', priority);
    }

    if (tags.length > 0) {
      query = query.where('tags', 'array-contains-any', tags.slice(0, 10));
    }

    query = query.orderBy('createdAt', 'desc').limit(fetchLimit);

    let snapshot;
    try {
      snapshot = await query.get();
    } catch (queryError) {
      logger.warn('Noticeboard query fallback triggered', queryError);
      snapshot = await db.collection('noticeboard')
        .where('status', '==', 'active')
        .orderBy('createdAt', 'desc')
        .limit(fetchLimit)
        .get();
    }
    
    // Process results
    let notices = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      notices.push(normalizeImageFields({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
        expiresAt: data.expiresAt?.toDate?.()?.toISOString() || null
      }));
    });
    
    // Filter out expired notices first
    const now = new Date();
    notices = notices.filter(notice => {
      if (!notice.expiresAt) return true; // No expiry date
      return new Date(notice.expiresAt) > now;
    });

    // Apply filters BEFORE pagination
    const filteredNotices = notices.filter((notice) => {
      const normalizedTitle = notice.title?.toLowerCase() || '';
      const normalizedDescription = notice.description?.toLowerCase() || '';
      const normalizedContent = notice.content?.toLowerCase() || '';
      const normalizedLocation = notice.location?.toLowerCase() || '';
      const noticeCategory = String(notice.category || notice.noticeType || '').toLowerCase();
      const noticePriority = String(notice.priority || '').toLowerCase();

      const itemTags = Array.isArray(notice.tags)
        ? notice.tags.map((tag) => String(tag).toLowerCase())
        : [];

      const matchesSearch = !search ||
        normalizedTitle.includes(search.toLowerCase()) ||
        normalizedDescription.includes(search.toLowerCase()) ||
        normalizedContent.includes(search.toLowerCase());

      const matchesLocation = !location || normalizedLocation.includes(location.toLowerCase());
      const matchesCategory = !category || noticeCategory === category.toLowerCase();
      const matchesPriority = !priority || noticePriority === priority.toLowerCase();
      const matchesTags = tags.length === 0 || tags.some((tag) => itemTags.includes(tag));

      return matchesSearch && matchesLocation && matchesCategory && matchesPriority && matchesTags;
    });

    // Apply sorting
    filteredNotices.sort((a, b) => {
      if (sortBy === 'createdAt') {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return sortOrder === 'asc' ? aTime - bTime : bTime - aTime;
      }
      if (sortBy === 'title') {
        const aTitle = (a.title || '').toLowerCase();
        const bTitle = (b.title || '').toLowerCase();
        return sortOrder === 'asc'
          ? aTitle.localeCompare(bTitle)
          : bTitle.localeCompare(aTitle);
      }
      return 0;
    });

    // Pagination AFTER filtering
    const totalCount = filteredNotices.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedNotices = filteredNotices.slice(startIndex, endIndex);
    const hasMore = endIndex < totalCount;
    
    const result = {
      success: true,
      data: paginatedNotices,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore
      }
    };
    
    // Cache the result for 3 minutes (shorter for notices as they're more time-sensitive)
    cache.set(cacheKey, result, 180000);
    
    return NextResponse.json(result);
    
  } catch (error) {
    logger.error('Error fetching noticeboard items', error);
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
    return errorResponse('Failed to fetch noticeboard items', 'NOTICEBOARD_FETCH_FAILED', 500);
  }
}

// POST - Create a new noticeboard item (authenticated)
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
    if (!data.title || !data.description) {
      return errorResponse('Missing required fields', 'VALIDATION_ERROR', 400);
    }
    
    // Use admin Firestore
    const db = getAdminFirestore();
    const userTrustFields = await getUserTrustFields(db, userId);
    const docRef = db.collection('noticeboard').doc();
    
    // Generate slug
    const slug = `${data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${docRef.id.slice(-6)}`;
    
    // Calculate expiry date if not provided
    let expiresAt = null;
    if (data.expiresAt) {
      expiresAt = new Date(data.expiresAt);
    } else if (data.category) {
      // Set default expiry based on category
      const defaultExpiry = {
        'event': 7, // 7 days for events
        'announcement': 30, // 30 days for announcements
        'lost-found': 14, // 14 days for lost & found
        'general': 21 // 21 days for general notices
      };
      const daysToExpire = defaultExpiry[data.category] || 21;
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + daysToExpire);
    }
    
    // Prepare noticeboard data
    const noticeData = {
      ...normalizeImageFields(data),
      ...userTrustFields,
      userId,
      slug,
      status: 'active',
      priority: data.priority || 'normal',
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt,
      titleLower: data.title.toLowerCase(),
      locationLower: data.location?.toLowerCase() || ''
    };
    
    await docRef.set(noticeData);

    if (isAppDbEnabled()) {
      try {
        await upsertPublicListings('noticeboard', [{ id: docRef.id, ...noticeData }]);
      } catch (postgresError) {
        logger.warn('Failed to sync created noticeboard item to PostgreSQL', postgresError);
      }
    }
    
    return NextResponse.json({
      success: true,
      id: docRef.id,
      data: noticeData
    });
    
  } catch (error) {
    logger.error('Error creating noticeboard item', error);
    return errorResponse('Failed to create noticeboard item', 'NOTICEBOARD_CREATE_FAILED', 500);
  }
}
