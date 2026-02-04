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

    // Validate required fields
    if (!data.collectionName) {
      return NextResponse.json(
        { error: 'Collection name is required' },
        { status: 400 }
      );
    }

    // Validate collection name
    const validCollections = ['properties', 'marketplace', 'services', 'noticeboard', 'housemates'];
    if (!validCollections.includes(data.collectionName)) {
      return NextResponse.json(
        { error: 'Invalid collection name' },
        { status: 400 }
      );
    }

    // Get Admin Firestore
    const db = getAdminFirestore();
    const collectionRef = db.collection(data.collectionName);
    const docRef = collectionRef.doc();

    // Generate slug for the document
    const { generateDocumentSlug } = await import('@/utils/slugify');
    const title = data.title || data.name || 'Untitled';
    const slug = generateDocumentSlug(title, docRef.id);

    // Remove collectionName from data before saving (it's metadata, not document data)
    const { collectionName, ...documentData } = data;

    // Prepare document data with proper timestamps and metadata
    const finalData = {
      ...documentData,
      userId,
      slug,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      // Add search-friendly lowercase fields
      titleLower: title.toLowerCase(),
      locationLower: (data.location || '').toLowerCase(),
      // Parse numeric price for filtering
      priceNumeric: parseFloat(String(data.price || data.rentPerMonth || 0).replace(/[^0-9.]/g, '')) || 0
    };

    // For properties, infer listing type if not provided
    if (collectionName === 'properties' && !finalData.listingType) {
      finalData.listingType = data.rentPerMonth ? 'rent' : 'sale';
    }

    // Save to Firestore
    await docRef.set(finalData);

    logger.info(`Ad created successfully in ${collectionName}`, { docId: docRef.id, userId });

    return NextResponse.json({
      success: true,
      id: docRef.id,
      slug,
      collectionName
    });

  } catch (error) {
    logger.error('Error creating ad', error);
    return NextResponse.json(
      { error: 'Failed to create ad: ' + error.message },
      { status: 500 }
    );
  }
}