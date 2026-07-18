export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { normalizeImageFields } from '@/lib/hubFirestore';
import listingRepository from '@/lib/db/listing-repository.cjs';
const { fetchListingBySlug, fetchSimilarListings, isAppDbEnabled } = listingRepository;

// GET - Fetch a service/tradesperson by slug
export async function GET(request, { params }) {
  try {
    const { slug } = await params;

    if (isAppDbEnabled()) {
      try {
        const postgresService = await fetchListingBySlug('services', slug);
        if (postgresService) {
          const similar = await fetchSimilarListings({
            collectionName: 'services',
            excludeId: postgresService.id,
            serviceType: postgresService.serviceType || '',
            limit: 3
          });

          return NextResponse.json({
            success: true,
            data: normalizeImageFields(postgresService),
            similar: similar.map((item) => normalizeImageFields(item)),
            source: 'postgres'
          });
        }
      } catch (postgresError) {
        console.warn('PostgreSQL service slug lookup failed, falling back to Firestore:', postgresError);
      }
    }
    
    const db = getAdminFirestore();
    
    // Query by slug
    const snapshot = await db.collection('services')
      .where('slug', '==', slug)
      .where('status', '==', 'active')
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      );
    }
    
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
        console.warn('Failed to load service listing user:', userError);
      }
    }
    
    // Get similar services efficiently (fallback to simple query if serviceType filtering fails)
    let similarQuery;
    try {
      if (data.serviceType) {
        similarQuery = db.collection('services')
          .where('status', '==', 'active')
          .where('serviceType', '==', data.serviceType)
          .orderBy('createdAt', 'desc')
          .limit(4);
      } else {
        similarQuery = db.collection('services')
          .where('status', '==', 'active')
          .orderBy('createdAt', 'desc')
          .limit(4);
      }
    } catch (error) {
      // Fallback to simple query without serviceType filter
      similarQuery = db.collection('services')
        .where('status', '==', 'active')
        .orderBy('createdAt', 'desc')
        .limit(4);
    }
    
    const similarServices = [];
    
    try {
      const similarSnapshot = await similarQuery.get();
      
      similarSnapshot.forEach(similarDoc => {
        if (similarDoc.id !== doc.id) {
          const similarData = similarDoc.data();
          similarServices.push({
            id: similarDoc.id,
            ...similarData,
            createdAt: similarData.createdAt?.toDate().toISOString(),
            updatedAt: similarData.updatedAt?.toDate().toISOString()
          });
        }
      });
    } catch (error) {
      console.warn('Error fetching similar services:', error);
      // Continue without similar services
    }
    
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
      similar: similarServices.slice(0, 3).map((item) => normalizeImageFields(item))
    });
    
  } catch (error) {
    console.error('Error fetching service by slug:', error);
    return NextResponse.json(
      { error: 'Failed to fetch service' },
      { status: 500 }
    );
  }
}
