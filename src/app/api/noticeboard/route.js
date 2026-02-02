import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuth } from 'firebase-admin/auth';
import { getAdminFirestore } from '@/lib/firebase-admin';
import cache, { cacheKeys } from '@/lib/cache';
import { verifyAuth, isAdmin } from '@/lib/auth-middleware';
import logger from '@/lib/logger';

// GET - Fetch noticeboard items with efficient server-side filtering
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Extract query parameters
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category');
    const priority = searchParams.get('priority');
    const location = searchParams.get('location');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    
    // Create cache key from parameters
    const cacheParams = {
      page, limit, search, category, priority, location, sortBy, sortOrder
    };
    
    const cacheKey = cacheKeys.noticeboard(cacheParams);
    
    // Check cache first
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
      return NextResponse.json(cachedResult);
    }
    
    // Initialize admin SDK
    const db = getAdminFirestore();
    
    // Simple query - only filter by status and sort
    let query = db.collection('noticeboard')
      .where('status', '==', 'active')
      .orderBy('createdAt', 'desc')
      .limit(50); // Get more items to allow for filtering
    
    // Execute query
    const snapshot = await query.get();
    
    // Process results
    let notices = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      notices.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate().toISOString(),
        updatedAt: data.updatedAt?.toDate().toISOString(),
        expiresAt: data.expiresAt?.toDate().toISOString()
      });
    });
    
    // Check if there are more results
    const hasMore = notices.length > limit;
    if (hasMore) {
      notices = notices.slice(0, limit);
    }
    
    // Apply client-side filters for text search and location
    if (search || location) {
      notices = notices.filter(notice => {
        const matchesSearch = !search || 
          notice.title?.toLowerCase().includes(search.toLowerCase()) ||
          notice.description?.toLowerCase().includes(search.toLowerCase()) ||
          notice.content?.toLowerCase().includes(search.toLowerCase());
        
        const matchesLocation = !location || 
          notice.location?.toLowerCase().includes(location.toLowerCase());
        
        return matchesSearch && matchesLocation;
      });
    }
    
    // Filter out expired notices
    const now = new Date();
    notices = notices.filter(notice => {
      if (!notice.expiresAt) return true; // No expiry date
      return new Date(notice.expiresAt) > now;
    });
    
    // Get total count for pagination info
    const countQuery = db.collection('noticeboard')
      .where('status', '==', 'active');
    
    if (category) {
      countQuery.where('category', '==', category);
    }
    
    if (priority) {
      countQuery.where('priority', '==', priority);
    }
    
    const countSnapshot = await countQuery.count().get();
    const totalCount = countSnapshot.data().count;
    
    const result = {
      success: true,
      data: notices,
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
    return NextResponse.json(
      { error: 'Failed to fetch noticeboard items' },
      { status: 500 }
    );
  }
}

// POST - Create a new noticeboard item (authenticated)
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
    if (!data.title || !data.description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Use admin Firestore
    const db = getFirestore();
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
      ...data,
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
    
    return NextResponse.json({
      success: true,
      id: docRef.id,
      data: noticeData
    });
    
  } catch (error) {
    logger.error('Error creating noticeboard item', error);
    return NextResponse.json(
      { error: 'Failed to create noticeboard item' },
      { status: 500 }
    );
  }
}