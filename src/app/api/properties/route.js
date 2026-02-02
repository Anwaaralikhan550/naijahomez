import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuth } from 'firebase-admin/auth';
import { getAdminFirestore } from '@/lib/firebase-admin';
import cache, { cacheKeys } from '@/lib/cache';
import { generateDocumentSlug } from '@/utils/slugify';
import logger from '@/lib/logger';

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
    const listingType = searchParams.get('listingType');
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
    
    // Get Admin Firestore
    const db = getAdminFirestore();

    // Build base query
    let baseQuery = db.collection('properties');

    // Apply listing type filter at Firestore level if specified
    if (listingType) {
      baseQuery = baseQuery.where('listingType', '==', listingType);
    }

    // Estimate total count (to avoid quota issues with count() queries)
    // We'll use a cached/estimated value
    const estimatedTotalInFirestore = listingType === 'rent' ? 2500 : listingType === 'sale' ? 2400 : 4930;
    console.log(`Estimated total properties: ${estimatedTotalInFirestore}`);

    // Fetch properties with buffer for additional filtering (status, search, etc.)
    const bufferMultiplier = 5; // Fetch 5x to account for filtering
    const fetchLimit = Math.min(limit * bufferMultiplier, 500); // Cap at 500

    let query = baseQuery
      .orderBy('createdAt', 'desc')
      .limit(fetchLimit);

    console.log(`Fetching up to ${fetchLimit} properties for page ${page}...`);
    const snapshot = await query.get();
    console.log(`Raw properties fetched: ${snapshot.docs.length}`);

    // Process results
    let properties = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      properties.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate().toISOString(),
        updatedAt: data.updatedAt?.toDate().toISOString()
      });
    });

    // Apply all filters client-side
    properties = properties.filter(property => {
      // Status filter - include active and undefined properties
      const matchesStatus = property.status === 'active' ||
                           property.status === undefined ||
                           property.status === null ||
                           property.status === 'undefined';

      // Text search filter
      const matchesSearch = !search ||
        property.title?.toLowerCase().includes(search.toLowerCase()) ||
        property.description?.toLowerCase().includes(search.toLowerCase());

      // Location filter
      const matchesLocation = !location ||
        property.location?.toLowerCase().includes(location.toLowerCase());

      // Property type filter
      const matchesPropertyType = !propertyType ||
        property.propertyType === propertyType;

      // NOTE: Listing type filter is now applied at Firestore level

      // Price filters
      const propertyPrice = property.priceNumeric || 0;
      const matchesMinPrice = !minPrice || propertyPrice >= parseFloat(minPrice);
      const matchesMaxPrice = !maxPrice || propertyPrice <= parseFloat(maxPrice);

      // Room filters
      const matchesBedrooms = !bedrooms || property.bedrooms == parseInt(bedrooms);
      const matchesBathrooms = !bathrooms || property.bathrooms == parseInt(bathrooms);

      return matchesStatus && matchesSearch && matchesLocation && matchesPropertyType &&
             matchesMinPrice && matchesMaxPrice && matchesBedrooms && matchesBathrooms;
    });

    console.log(`Properties after filtering: ${properties.length}`);

    // Step 4: Calculate estimated total based on filter ratio
    // If no filters applied, use status-based estimate
    const hasFilters = search || location || propertyType || listingType || minPrice || maxPrice || bedrooms || bathrooms;
    let estimatedTotal;

    if (!hasFilters) {
      // No filters - use estimated total
      estimatedTotal = estimatedTotalInFirestore;
    } else {
      // With filters - extrapolate from fetched sample
      const filterRatio = properties.length / snapshot.docs.length;
      estimatedTotal = Math.round(estimatedTotalInFirestore * filterRatio);
    }

    console.log(`Estimated total properties matching filters: ${estimatedTotal}`);

    // Apply sorting
    properties.sort((a, b) => {
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

    // Apply pagination to filtered results
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedProperties = properties.slice(startIndex, endIndex);

    // Determine if there are more properties
    const hasMore = endIndex < properties.length || snapshot.docs.length >= fetchLimit;
    
    const result = {
      success: true,
      data: paginatedProperties,
      pagination: {
        page,
        limit,
        total: estimatedTotal, // Total properties matching filters
        totalPages: Math.ceil(estimatedTotal / limit),
        hasMore
      }
    };
    
    // Cache the result for 30 seconds during development
    cache.set(cacheKey, result, 30000);
    
    return NextResponse.json(result);
    
  } catch (error) {
    logger.error('Error fetching properties', error);
    return NextResponse.json(
      { error: 'Failed to fetch properties' },
      { status: 500 }
    );
  }
}

// POST - Create a new property (authenticated)
export async function POST(request) {
  try {
    // Verify authentication using the auth middleware
    const authResult = await import('@/lib/auth-middleware').then(m => m.verifyAuth(request));
    
    if (!authResult.success) {
      return authResult.error;
    }

    const userId = authResult.userId;

    const data = await request.json();
    
    // Validate required fields
    if (!data.title || !data.location || !data.price) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Use admin Firestore
    const db = getAdminFirestore();
    const docRef = db.collection('properties').doc();
    
    // Generate unique slug using document ID
    const uniqueSlug = generateDocumentSlug(data.title, docRef.id);
    
    // Prepare property data
    const propertyData = {
      ...data,
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
    
    return NextResponse.json({
      success: true,
      id: docRef.id,
      data: propertyData
    });
    
  } catch (error) {
    logger.error('Error creating property', error);
    return NextResponse.json(
      { error: 'Failed to create property' },
      { status: 500 }
    );
  }
}