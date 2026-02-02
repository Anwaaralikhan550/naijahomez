import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import cache, { cacheKeys } from '@/lib/cache';
import { verifyAuth, isAdmin } from '@/lib/auth-middleware';
import logger from '@/lib/logger';

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
    const location = searchParams.get('location');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    
    // Create cache key from parameters
    const cacheParams = {
      page, limit, search, minPrice, maxPrice, condition, category,
      location, sortBy, sortOrder
    };
    
    const cacheKey = cacheKeys.marketplace(cacheParams);
    
    // Check cache first
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
      return NextResponse.json(cachedResult);
    }
    
    // Initialize admin SDK
    const db = getAdminFirestore();
    
    // Simple query - only filter by status and sort
    let query = db.collection('marketplace')
      .where('status', '==', 'active')
      .orderBy('createdAt', 'desc')
      .limit(50); // Get more items to allow for filtering
    
    // Execute query
    const snapshot = await query.get();
    
    // Process results
    let items = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      items.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate().toISOString(),
        updatedAt: data.updatedAt?.toDate().toISOString()
      });
    });
    
    // Check if there are more results
    const hasMore = items.length > limit;
    if (hasMore) {
      items = items.slice(0, limit);
    }
    
    // Apply client-side filters for text search, location, category, and condition
    if (search || location || category || condition) {
      items = items.filter(item => {
        const matchesSearch = !search ||
          item.title?.toLowerCase().includes(search.toLowerCase()) ||
          item.description?.toLowerCase().includes(search.toLowerCase());

        const matchesLocation = !location ||
          item.location?.toLowerCase().includes(location.toLowerCase());

        const matchesCategory = !category ||
          item.category === category ||
          item.subcategory === category ||
          item.category?.toLowerCase().replace(/[\s&]+/g, '-').replace(/[^a-z0-9-]/g, '') === category;

        const matchesCondition = !condition ||
          item.condition === condition;

        return matchesSearch && matchesLocation && matchesCategory && matchesCondition;
      });
    }
    
    // Get total count for pagination info
    const countQuery = db.collection('marketplace')
      .where('status', '==', 'active');
    
    if (condition) {
      countQuery.where('condition', '==', condition);
    }
    
    if (category) {
      countQuery.where('category', '==', category);
    }
    
    const countSnapshot = await countQuery.count().get();
    const totalCount = countSnapshot.data().count;
    
    const result = {
      success: true,
      data: items,
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
    return NextResponse.json(
      { error: 'Failed to fetch marketplace items' },
      { status: 500 }
    );
  }
}

// POST - Create a new marketplace item (authenticated)
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
    if (!data.title || !data.location || !data.price) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Use admin Firestore
    const db = getFirestore();
    const docRef = db.collection('marketplace').doc();
    
    // Generate slug
    const slug = `${data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${docRef.id.slice(-6)}`;
    
    // Prepare marketplace item data
    const itemData = {
      ...data,
      userId,
      slug,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      titleLower: data.title.toLowerCase(),
      locationLower: data.location.toLowerCase(),
      priceNumeric: parseFloat(String(data.price).replace(/[^0-9.]/g, '')) || 0
    };
    
    await docRef.set(itemData);
    
    return NextResponse.json({
      success: true,
      id: docRef.id,
      data: itemData
    });
    
  } catch (error) {
    logger.error('Error creating marketplace item', error);
    return NextResponse.json(
      { error: 'Failed to create marketplace item' },
      { status: 500 }
    );
  }
}