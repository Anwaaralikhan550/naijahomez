export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { normalizeImageFields } from '@/lib/hubFirestore';

const errorResponse = (message, code, status = 500) =>
  NextResponse.json({ success: false, error: message, code }, { status });

const HOUSEMATE_COLLECTIONS = ['housemates', 'housemate'];

const findActiveHousemate = async (db, slug) => {
  for (const collectionName of HOUSEMATE_COLLECTIONS) {
    const snapshot = await db.collection(collectionName)
      .where('slug', '==', slug)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (!snapshot.empty) {
      return { collectionName, doc: snapshot.docs[0] };
    }

    const doc = await db.collection(collectionName).doc(slug).get();
    if (doc.exists && doc.data()?.status === 'active') {
      return { collectionName, doc };
    }
  }

  return { collectionName: null, doc: null };
};

const fetchSimilarHousemates = async (db, currentDoc, data) => {
  const similarHousemates = [];

  for (const collectionName of HOUSEMATE_COLLECTIONS) {
    let query = db.collection(collectionName)
      .where('status', '==', 'active');

    if (data.gender) {
      query = query.where('gender', '==', data.gender);
    }

    try {
      query = query.orderBy('createdAt', 'desc').limit(4);
      const similarSnapshot = await query.get();

      similarSnapshot.forEach(similarDoc => {
        if (similarDoc.id !== currentDoc.id) {
          const similarData = similarDoc.data();
          similarHousemates.push({
            id: similarDoc.id,
            collectionName,
            ...similarData,
            slug: similarData.slug || similarDoc.id,
            createdAt: similarData.createdAt?.toDate?.()?.toISOString() || null,
            updatedAt: similarData.updatedAt?.toDate?.()?.toISOString() || null
          });
        }
      });
    } catch (similarError) {
      console.warn(`Failed to load similar housemates from ${collectionName}:`, similarError);
    }
  }

  return similarHousemates;
};

// GET - Fetch a housemate listing by slug
export async function GET(request, { params }) {
  try {
    const { slug } = params;
    
    const db = getAdminFirestore();
    
    const { collectionName, doc } = await findActiveHousemate(db, slug);

    if (!doc?.exists) {
      return errorResponse('Housemate listing not found', 'HOUSEMATE_NOT_FOUND', 404);
    }
    
    const data = doc.data();
    let listingUser = null;

    if (data.userId) {
      try {
        const userDoc = await db.collection('users').doc(data.userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data() || {};
          listingUser = {
            id: userDoc.id,
            uid: userData.uid || userDoc.id,
            displayName: userData.displayName || userData.name || null,
            email: userData.email || null,
            phoneNumber: userData.phoneNumber || userData.phone || null,
            kycStatus: userData.kycStatus || null,
            idVerification: userData.idVerification || null,
            cacVerification: userData.cacVerification || null,
            updatedAt: userData.updatedAt?.toDate?.()?.toISOString() || null,
            createdAt: userData.createdAt?.toDate?.()?.toISOString() || null
          };
        }
      } catch (userError) {
        console.warn('Failed to load housemate listing user:', userError);
      }
    }
    
    // Get similar listings from both current and legacy collections.
    const similarHousemates = await fetchSimilarHousemates(db, doc, data);
    
    return NextResponse.json({
      success: true,
      data: normalizeImageFields({
        id: doc.id,
        collectionName,
        ...data,
        slug: data.slug || doc.id,
        user: listingUser,
        kycStatus: data.kycStatus || listingUser?.kycStatus || null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null
      }),
      similar: similarHousemates.slice(0, 3).map((item) => normalizeImageFields(item))
    });
    
  } catch (error) {
    console.error('Error fetching housemate listing by slug:', error);
    return errorResponse('Failed to fetch housemate listing', 'HOUSEMATE_FETCH_FAILED', 500);
  }
}
