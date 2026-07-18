export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuth } from 'firebase-admin/auth';
import { getAdminFirestore } from '@/lib/firebase-admin';
import cache, { cacheKeys } from '@/lib/cache';
import { verifyAuth, isAdmin } from '@/lib/auth-middleware';
import logger from '@/lib/logger';
import { validateListingStringLengths, buildLengthExceededErrorMessage } from '@/lib/listingLengthValidation';

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
import { normalizeImageFields } from '@/lib/hubFirestore';
import { getUserTrustFields } from '@/lib/kyc/kyc-service';
import listingRepository from '@/lib/db/listing-repository.cjs';
const { fetchListings, isAppDbEnabled, upsertPublicListings } = listingRepository;

function isQuotaExceededError(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === 8 || message.includes('resource_exhausted') || message.includes('quota exceeded');
}

// GET - Fetch tradespeople/services with efficient server-side filtering
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Extract query parameters
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');
    const search = searchParams.get('search') || '';
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const serviceType = searchParams.get('serviceType');
    const location = searchParams.get('location');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const featured = searchParams.get('featured') === 'true';
    
    // Create cache key from parameters
    const cacheParams = {
      page, limit, search, minPrice, maxPrice, serviceType,
      location, sortBy, sortOrder, featured
    };
    
    const cacheKey = cacheKeys.tradespeople(cacheParams);
    
    // Check cache first
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
      return NextResponse.json(cachedResult);
    }

    if (isAppDbEnabled()) {
      try {
        const postgresResult = await fetchListings({
          collectionName: 'services',
          page,
          limit,
          search,
          minPrice,
          maxPrice,
          location,
          sortBy,
          sortOrder,
          filters: {
            serviceType,
            featured
          }
        });

        if (postgresResult?.pagination?.total > 0 || process.env.POSTGRES_ALLOW_EMPTY_RESULTS === 'true') {
          postgresResult.data = postgresResult.data.map((service) => normalizeImageFields(service));
          cache.set(cacheKey, postgresResult, 300000);
          return NextResponse.json(postgresResult);
        }
      } catch (postgresError) {
        logger.warn('PostgreSQL tradespeople query failed, falling back to Firestore', postgresError);
      }
    }
    
    // Initialize admin SDK
    const db = getAdminFirestore();

    const fetchLimit = Math.min(Math.max(limit * 6, 60), 220);
    let query = db.collection('services')
      .where('status', '==', 'active');

    if (serviceType) {
      query = query.where('serviceType', '==', serviceType);
    }

    query = query.orderBy('createdAt', 'desc').limit(fetchLimit);

    let snapshot;
    try {
      snapshot = await query.get();
    } catch (queryError) {
      logger.warn('Tradespeople query fallback triggered', queryError);
      snapshot = await db.collection('services')
        .where('status', '==', 'active')
        .orderBy('createdAt', 'desc')
        .limit(fetchLimit)
        .get();
    }
    
    // Process results
    let services = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      services.push(normalizeImageFields({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null
      }));
    });
    
    // Apply all filters client-side
    services = services.filter(service => {
      // Text search filter
      const matchesSearch = !search || 
        service.title?.toLowerCase().includes(search.toLowerCase()) ||
        service.description?.toLowerCase().includes(search.toLowerCase()) ||
        service.provider?.toLowerCase().includes(search.toLowerCase());
      
      // Location filter
      const matchesLocation = !location || 
        service.location?.toLowerCase().includes(location.toLowerCase());
      
      // Service type filter
      const matchesServiceType = !serviceType || 
        service.serviceType === serviceType;
      
      // Price filters
      const servicePrice = service.priceNumeric || 0;
      const matchesMinPrice = !minPrice || servicePrice >= parseFloat(minPrice);
      const matchesMaxPrice = !maxPrice || servicePrice <= parseFloat(maxPrice);
      
      // Featured filter - services with rating >= 4.0 or no rating filter
      const matchesFeatured = !featured || (service.rating && service.rating >= 4.0);
      
      return matchesSearch && matchesLocation && matchesServiceType && 
             matchesMinPrice && matchesMaxPrice && matchesFeatured;
    });
    
    // Apply sorting
    services.sort((a, b) => {
      if (sortBy === 'createdAt') {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return sortOrder === 'desc' ? bTime - aTime : aTime - bTime;
      }
      if (sortBy === 'rating') {
        const aRating = a.rating || 0;
        const bRating = b.rating || 0;
        return sortOrder === 'desc' ? bRating - aRating : aRating - bRating;
      }
      return 0;
    });
    
    // Get total count for pagination info
    let countQuery = db.collection('services')
      .where('status', '==', 'active');

    if (serviceType) {
      countQuery = countQuery.where('serviceType', '==', serviceType);
    }

    const countSnapshot = await countQuery.count().get();
    const totalCount = countSnapshot.data().count;

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedServices = services.slice(startIndex, endIndex);
    const hasMore = endIndex < services.length;

    const result = {
      success: true,
      data: paginatedServices,
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
    logger.error('Error fetching tradespeople', error);
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
    return errorResponse('Failed to fetch tradespeople', 'TRADESPEOPLE_FETCH_FAILED', 500);
  }
}

// POST - Create a new service/tradesperson listing (authenticated)
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
    if (!data.title || !data.location || !data.serviceType) {
      return errorResponse('Missing required fields', 'VALIDATION_ERROR', 400);
    }
    
    // Use admin Firestore
    const db = getAdminFirestore();
    const userTrustFields = await getUserTrustFields(db, userId);
    const docRef = db.collection('services').doc();
    
    // Generate slug
    const slug = `${data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${docRef.id.slice(-6)}`;
    
    // Prepare service data
    const serviceData = {
      ...data,
      ...userTrustFields,
      userId,
      slug,
      status: 'active',
      rating: data.rating || 0,
      reviewCount: data.reviewCount || 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      titleLower: data.title.toLowerCase(),
      locationLower: data.location.toLowerCase(),
      priceNumeric: parseFloat(String(data.price || data.priceString || '0').replace(/[^0-9.]/g, '')) || 0
    };
    
    await docRef.set(serviceData);

    if (isAppDbEnabled()) {
      try {
        await upsertPublicListings('services', [{ id: docRef.id, ...serviceData }]);
      } catch (postgresError) {
        logger.warn('Failed to sync created service to PostgreSQL', postgresError);
      }
    }
    
    return NextResponse.json({
      success: true,
      id: docRef.id,
      data: serviceData
    });
    
  } catch (error) {
    logger.error('Error creating service', error);
    return errorResponse('Failed to create service', 'SERVICE_CREATE_FAILED', 500);
  }
}
