import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuth } from 'firebase-admin/auth';
import { getAdminFirestore } from '@/lib/firebase-admin';
import cache, { cacheKeys } from '@/lib/cache';
import { verifyAuth, isAdmin } from '@/lib/auth-middleware';
import logger from '@/lib/logger';

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
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    
    // Create cache key from parameters
    const cacheParams = {
      page, limit, search, minBudget, maxBudget, gender,
      location, roomType, sortBy, sortOrder
    };
    
    const cacheKey = cacheKeys.housemates(cacheParams);
    
    // Check cache first
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
      return NextResponse.json(cachedResult);
    }
    
    // Initialize admin SDK
    const db = getAdminFirestore();
    
    // Simple query - only filter by status and sort
    let query = db.collection('housemate')
      .where('status', '==', 'active')
      .orderBy('createdAt', 'desc')
      .limit(50); // Get more items to allow for filtering
    
    // Execute query
    const snapshot = await query.get();
    
    // Process results
    let housemates = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      housemates.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate().toISOString(),
        updatedAt: data.updatedAt?.toDate().toISOString()
      });
    });
    
    // Check if there are more results
    const hasMore = housemates.length > limit;
    if (hasMore) {
      housemates = housemates.slice(0, limit);
    }
    
    // Apply client-side filters for text search and location
    if (search || location) {
      housemates = housemates.filter(housemate => {
        const matchesSearch = !search || 
          housemate.title?.toLowerCase().includes(search.toLowerCase()) ||
          housemate.description?.toLowerCase().includes(search.toLowerCase()) ||
          housemate.name?.toLowerCase().includes(search.toLowerCase());
        
        const matchesLocation = !location || 
          housemate.location?.toLowerCase().includes(location.toLowerCase());
        
        return matchesSearch && matchesLocation;
      });
    }
    
    // Get total count for pagination info
    const countQuery = db.collection('housemate')
      .where('status', '==', 'active');
    
    if (gender) {
      countQuery.where('gender', '==', gender);
    }
    
    if (roomType) {
      countQuery.where('roomType', '==', roomType);
    }
    
    const countSnapshot = await countQuery.count().get();
    const totalCount = countSnapshot.data().count;
    
    const result = {
      success: true,
      data: housemates,
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
    return NextResponse.json(
      { error: 'Failed to fetch housemates' },
      { status: 500 }
    );
  }
}

// POST - Create a new housemate listing (authenticated)
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
    if (!data.title || !data.location) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Use admin Firestore
    const db = getFirestore();
    const docRef = db.collection('housemate').doc();
    
    // Generate slug
    const slug = `${data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${docRef.id.slice(-6)}`;
    
    // Prepare housemate data
    const housemateData = {
      ...data,
      userId,
      slug,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      titleLower: data.title.toLowerCase(),
      locationLower: data.location.toLowerCase(),
      budgetNumeric: parseFloat(String(data.budget || data.budgetRange || '0').replace(/[^0-9.]/g, '')) || 0
    };
    
    await docRef.set(housemateData);
    
    return NextResponse.json({
      success: true,
      id: docRef.id,
      data: housemateData
    });
    
  } catch (error) {
    logger.error('Error creating housemate listing', error);
    return NextResponse.json(
      { error: 'Failed to create housemate listing' },
      { status: 500 }
    );
  }
}