import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Count all active listings for this user across all categories
    const db = getAdminFirestore();
    const collections = ['properties', 'housemates', 'marketplace', 'tradespeople', 'notices'];
    let totalCount = 0;

    for (const collection of collections) {
      try {
        const snapshot = await db.collection(collection)
          .where('userId', '==', userId)
          .where('status', '==', 'active') // Only count active listings
          .get();
        
        totalCount += snapshot.size;
      } catch (error) {
        console.log(`Collection ${collection} might not exist or have different structure:`, error.message);
        // Continue with other collections even if one fails
      }
    }

    return NextResponse.json({ count: totalCount });
  } catch (error) {
    console.error('Error fetching user listings:', error);
    return NextResponse.json({ error: 'Failed to fetch user listings' }, { status: 500 });
  }
}