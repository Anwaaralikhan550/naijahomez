export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import listingRepository from '@/lib/db/listing-repository.cjs';

const { countUserListings, isAppDbEnabled } = listingRepository;

const errorResponse = (message, code, status = 500) =>
  NextResponse.json({ success: false, error: message, code }, { status });

const authErrorResponse = async (authError) => {
  const status = authError?.status || 401;
  const payload = await authError?.clone?.().json?.().catch(() => ({}));
  const message = payload?.error || 'Authentication required';
  const code = status === 403 ? 'FORBIDDEN' : status === 503 ? 'AUTH_SERVICE_UNAVAILABLE' : 'UNAUTHORIZED';
  return errorResponse(message, code, status);
};

export async function GET(request) {
  try {
    // Verify authentication first
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authErrorResponse(authResult.error);
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || authResult.userId;

    if (!userId) {
      return errorResponse('User ID is required', 'USER_ID_REQUIRED', 400);
    }

    // Count all active listings for this user across all categories
    if (isAppDbEnabled()) {
      const totalCount = await countUserListings({
        userId,
        collectionNames: ['properties', 'housemates', 'marketplace', 'services', 'noticeboard']
      });
      return NextResponse.json({ count: totalCount, source: 'postgres' });
    }

    // Emergency fallback only if PostgreSQL is disabled.
    const db = getAdminFirestore();
    const collections = ['properties', 'housemates', 'marketplace', 'tradespeople', 'notices'];
    const countResults = await Promise.all(collections.map(async (collection) => {
      try {
        const countSnapshot = await db.collection(collection)
          .where('userId', '==', userId)
          .where('status', '==', 'active')
          .count()
          .get();
        return countSnapshot.data().count || 0;
      } catch (error) {
        try {
          const fallbackSnapshot = await db.collection(collection)
            .where('userId', '==', userId)
            .where('status', '==', 'active')
            .get();
          return fallbackSnapshot.size || 0;
        } catch (fallbackError) {
          console.log(`Collection ${collection} might not exist or have different structure:`, fallbackError.message);
          return 0;
        }
      }
    }));

    const totalCount = countResults.reduce((sum, count) => sum + count, 0);

    return NextResponse.json({ count: totalCount });
  } catch (error) {
    console.error('Error fetching user listings:', error);
    return errorResponse('Failed to fetch user listings', 'USER_LISTINGS_FETCH_FAILED', 500);
  }
}
