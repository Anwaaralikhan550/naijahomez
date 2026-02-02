import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import logger from '@/lib/logger';

// GET - Fetch user's ads across all collections
export async function GET(request) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Verify user can only fetch their own ads
    if (userId !== authResult.user.uid) {
      return NextResponse.json(
        { error: 'You can only view your own ads' },
        { status: 403 }
      );
    }

    // Get Admin Firestore
    const db = getAdminFirestore();

    // Define collections to fetch from
    const collections = ['properties', 'marketplace', 'services', 'noticeboard'];
    const allAds = [];

    // Fetch from each collection
    for (const collectionName of collections) {
      const snapshot = await db
        .collection(collectionName)
        .where('userId', '==', userId)
        .get();

      const collectionAds = snapshot.docs.map(doc => ({
        id: doc.id,
        collectionName,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.().toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.().toISOString() || doc.data().updatedAt
      }));

      allAds.push(...collectionAds);
    }

    // Sort by creation date (newest first)
    allAds.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return NextResponse.json({
      success: true,
      ads: allAds
    });

  } catch (error) {
    logger.error('Error fetching ads', error);
    return NextResponse.json(
      { error: 'Failed to fetch ads' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
    try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const userId = authResult.user.uid;
    const data = await request.json();
      
      // Handle the ad submission
      // Save to database
      // Handle image uploads
      
      return Response.json({ success: true });
    } catch (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
  }