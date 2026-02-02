import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuth } from 'firebase-admin/auth';
import { getAdminFirestore } from '@/lib/firebase-admin';
import cache, { cacheKeys } from '@/lib/cache';
import { verifyAuth, isAdmin } from '@/lib/auth-middleware';
import logger from '@/lib/logger';

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
    
    // Initialize admin SDK
    const db = getAdminFirestore();
    
    // Simple query - only filter by status and sort
    let query = db.collection('services')
      .where('status', '==', 'active')
      .orderBy('createdAt', 'desc')
      .limit(50); // Get more items to allow for filtering
    
    // Execute query
    const snapshot = await query.get();
    
    // Process results
    let services = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      services.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate().toISOString(),
        updatedAt: data.updatedAt?.toDate().toISOString()
      });
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
    const countSnapshot = await db.collection('services')
      .where('status', '==', 'active')
      .count()
      .get();
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
    return NextResponse.json(
      { error: 'Failed to fetch tradespeople' },
      { status: 500 }
    );
  }
}

// POST - Create a new service/tradesperson listing (authenticated)
export async function POST(request) {
  try {
        // Verify authentication using the auth middleware
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const userId = authResult.userId;

    const data = await request.json();
    
    // Validate required fields
    if (!data.title || !data.location || !data.serviceType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Use admin Firestore
    const db = getFirestore();
    const docRef = db.collection('services').doc();
    
    // Generate slug
    const slug = `${data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${docRef.id.slice(-6)}`;
    
    // Prepare service data
    const serviceData = {
      ...data,
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
    
    return NextResponse.json({
      success: true,
      id: docRef.id,
      data: serviceData
    });
    
  } catch (error) {
    logger.error('Error creating service', error);
    return NextResponse.json(
      { error: 'Failed to create service' },
      { status: 500 }
    );
  }
}