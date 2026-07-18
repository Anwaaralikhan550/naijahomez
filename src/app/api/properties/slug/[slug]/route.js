export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { fixListingEncoding } from '@/utils/fixEncoding';
import { normalizeImageFields } from '@/lib/hubFirestore';
import descriptionGenerator from '@/lib/scrapers/listing-description-generator';
import listingRepository from '@/lib/db/listing-repository.cjs';
import path from 'path';
import { promises as fs } from 'fs';

const PROPERTY_FALLBACK_CACHE_PATH = process.env.PROPERTY_FALLBACK_CACHE_PATH ||
  path.join(process.cwd(), 'data', 'properties-fallback.json');
const { withPublicSafeDescription } = descriptionGenerator?.default || descriptionGenerator;
const { fetchListingBySlug, fetchSimilarListings, isAppDbEnabled } = listingRepository;

const errorResponse = (message, code, status = 500) =>
  NextResponse.json({ success: false, error: message, code }, { status });

function isQuotaExceededError(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === 8 || message.includes('resource_exhausted') || message.includes('quota exceeded');
}

async function findFallbackPropertyBySlug(slug) {
  try {
    const raw = await fs.readFile(PROPERTY_FALLBACK_CACHE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const data = Array.isArray(parsed?.data) ? parsed.data : [];
    const normalizedSlug = String(slug || '').trim();
    const item = data.find((entry) => String(entry?.slug || '').trim() === normalizedSlug);
    if (!item) return null;
    return {
      item: withPublicSafeDescription(fixListingEncoding(normalizeImageFields(item))),
      similar: data
        .filter((entry) => entry.slug !== item.slug)
        .slice(0, 3)
        .map((entry) => withPublicSafeDescription(fixListingEncoding(normalizeImageFields(entry))))
    };
  } catch {
    return null;
  }
}

// GET - Fetch a property by slug
export async function GET(request, { params }) {
  try {
    const { slug } = await params;
    console.log('Looking for property with slug:', slug);

    if (isAppDbEnabled()) {
      try {
        const postgresProperty = await fetchListingBySlug('properties', slug);
        if (postgresProperty) {
          const similar = await fetchSimilarListings({
            collectionName: 'properties',
            excludeId: postgresProperty.id,
            propertyType: postgresProperty.propertyType || 'house',
            listingType: postgresProperty.listingType || 'rent',
            limit: 3
          });

          return NextResponse.json({
            success: true,
            data: withPublicSafeDescription(fixListingEncoding(normalizeImageFields(postgresProperty))),
            similar: similar.map((item) => withPublicSafeDescription(fixListingEncoding(normalizeImageFields(item)))),
            source: 'postgres'
          });
        }
      } catch (postgresError) {
        console.warn('PostgreSQL property slug lookup failed, falling back to Firestore:', postgresError);
      }
    }
    
    const db = getAdminFirestore();
    
    // Query by slug
    const snapshot = await db.collection('properties')
      .where('slug', '==', slug)
      .where('status', '==', 'active')
      .limit(1)
      .get();
      
    console.log('Found properties:', snapshot.size);
    
    if (snapshot.empty) {
      return errorResponse('Property not found', 'PROPERTY_NOT_FOUND', 404);
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
        console.warn('Failed to load property listing user:', userError);
      }
    }
    
    // Get similar properties efficiently
    const similarQuery = db.collection('properties')
      .where('status', '==', 'active')
      .where('propertyType', '==', data.propertyType || 'house')
      .where('listingType', '==', data.listingType || 'rent')
      .orderBy('createdAt', 'desc')
      .limit(4);
    
    const similarSnapshot = await similarQuery.get();
    const similarProperties = [];
    
    similarSnapshot.forEach(similarDoc => {
      if (similarDoc.id !== doc.id) {
        const similarData = similarDoc.data();
        similarProperties.push({
          id: similarDoc.id,
          ...similarData,
          createdAt: similarData.createdAt?.toDate().toISOString(),
          updatedAt: similarData.updatedAt?.toDate().toISOString()
        });
      }
    });
    
    return NextResponse.json({
      success: true,
      data: withPublicSafeDescription(fixListingEncoding(normalizeImageFields({
        id: doc.id,
        ...data,
        user: listingUser,
        kycStatus: data.kycStatus || listingUser?.kycStatus || null,
        createdAt: data.createdAt?.toDate().toISOString(),
        updatedAt: data.updatedAt?.toDate().toISOString()
      }))),
      similar: similarProperties.slice(0, 3).map((item) => withPublicSafeDescription(fixListingEncoding(normalizeImageFields(item))))
    });
    
  } catch (error) {
    console.error('Error fetching property by slug:', error);
    if (isQuotaExceededError(error)) {
      const { slug } = await params;
      const fallback = await findFallbackPropertyBySlug(slug);
      if (fallback) {
        return NextResponse.json({
          success: true,
          data: fallback.item,
          similar: fallback.similar,
          fallback: true,
          stale: true
        });
      }
    }
    return errorResponse('Failed to fetch property', 'PROPERTY_FETCH_FAILED', 500);
  }
}
