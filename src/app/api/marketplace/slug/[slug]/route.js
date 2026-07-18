export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { normalizeImageFields } from '@/lib/hubFirestore';
import listingRepository from '@/lib/db/listing-repository.cjs';

const errorResponse = (message, code, status = 500) =>
  NextResponse.json({ success: false, error: message, code }, { status });
const { fetchListingBySlug, fetchSimilarListings, isAppDbEnabled } = listingRepository;

// GET - Fetch a marketplace item by slug
export async function GET(request, { params }) {
  try {
    const { slug } = await params;
    console.log(`Marketplace API: Looking for slug "${slug}"`);

    if (isAppDbEnabled()) {
      try {
        const postgresItem = await fetchListingBySlug('marketplace', slug);
        if (postgresItem) {
          const similar = await fetchSimilarListings({
            collectionName: 'marketplace',
            excludeId: postgresItem.id,
            category: postgresItem.category || 'general',
            limit: 3
          });

          return NextResponse.json({
            success: true,
            data: normalizeImageFields(postgresItem),
            similar: similar.map((item) => normalizeImageFields(item)),
            source: 'postgres'
          });
        }
      } catch (postgresError) {
        console.warn('PostgreSQL marketplace slug lookup failed, falling back to Firestore:', postgresError);
      }
    }
    
    const db = getAdminFirestore();
    
    // Query by slug (first try with status filter, then without)
    let snapshot = await db.collection('marketplace')
      .where('slug', '==', slug)
      .where('status', '==', 'active')
      .limit(1)
      .get();
    
    // If not found with active status, try without status filter
    if (snapshot.empty) {
      console.log(`No active item found for slug: ${slug}, trying without status filter`);
      snapshot = await db.collection('marketplace')
        .where('slug', '==', slug)
        .limit(1)
        .get();
    }
    
    if (snapshot.empty) {
      console.log(`No marketplace item found for slug: ${slug}`);
      return errorResponse('Marketplace item not found', 'MARKETPLACE_ITEM_NOT_FOUND', 404);
    }
    
    console.log(`Found marketplace item with slug: ${slug}`);
    
    const doc = snapshot.docs[0];
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
        console.warn('Failed to load marketplace listing user:', userError);
      }
    }
    
    // Get similar items efficiently
    const similarQuery = db.collection('marketplace')
      .where('status', '==', 'active')
      .where('category', '==', data.category || 'general')
      .orderBy('createdAt', 'desc')
      .limit(4);
    
    const similarSnapshot = await similarQuery.get();
    const similarItems = [];
    
    similarSnapshot.forEach(similarDoc => {
      if (similarDoc.id !== doc.id) {
        const similarData = similarDoc.data();
        similarItems.push({
          id: similarDoc.id,
          ...similarData,
          createdAt: similarData.createdAt?.toDate().toISOString(),
          updatedAt: similarData.updatedAt?.toDate().toISOString()
        });
      }
    });
    
    return NextResponse.json({
      success: true,
      data: normalizeImageFields({
        id: doc.id,
        ...data,
        user: listingUser,
        kycStatus: data.kycStatus || listingUser?.kycStatus || null,
        createdAt: data.createdAt?.toDate().toISOString(),
        updatedAt: data.updatedAt?.toDate().toISOString()
      }),
      similar: similarItems.slice(0, 3).map((item) => normalizeImageFields(item))
    });
    
  } catch (error) {
    console.error('Error fetching marketplace item by slug:', error);
    return errorResponse('Failed to fetch marketplace item', 'MARKETPLACE_FETCH_FAILED', 500);
  }
}
