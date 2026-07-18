import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import cache from '@/lib/cache';
import logger from '@/lib/logger';
import listingRepository from '@/lib/db/listing-repository.cjs';

export const dynamic = 'force-dynamic';

const CACHE_KEY = 'public-homepage-listing-stats-v2';
const CACHE_TTL_MS = 60000;
const { fetchListings, isAppDbEnabled } = listingRepository;

async function countActiveCollection(db, collectionName) {
  const snapshot = await db
    .collection(collectionName)
    .where('status', '==', 'active')
    .count()
    .get();

  return snapshot.data().count || 0;
}

async function countPublicListing(collectionName) {
  if (!isAppDbEnabled()) return null;

  const result = await fetchListings({
    collectionName,
    page: 1,
    limit: 1
  });

  return Number(result?.pagination?.total || 0);
}

export async function GET() {
  try {
    const cached = cache.get(CACHE_KEY);
    if (cached) {
      return NextResponse.json(cached);
    }

    let marketplace;
    let properties;
    let services;
    let housemates;

    try {
      [marketplace, properties, services, housemates] = await Promise.all([
        countPublicListing('marketplace'),
        countPublicListing('properties'),
        countPublicListing('services'),
        countPublicListing('housemates')
      ]);
    } catch (postgresError) {
      logger.warn('PostgreSQL public stats query failed, falling back to Firestore', postgresError);
    }

    if ([marketplace, properties, services, housemates].some((count) => count === null || count === undefined)) {
      const db = getAdminFirestore();
      [marketplace, properties, services, housemates] = await Promise.all([
        countActiveCollection(db, 'marketplace'),
        countActiveCollection(db, 'properties'),
        countActiveCollection(db, 'services'),
        countActiveCollection(db, 'housemates')
      ]);
    }

    const result = {
      success: true,
      data: {
        marketplace,
        properties,
        services,
        housemates,
        total: marketplace + properties + services + housemates
      },
      generatedAt: new Date().toISOString()
    };

    cache.set(CACHE_KEY, result, CACHE_TTL_MS);
    return NextResponse.json(result);
  } catch (error) {
    logger.error('Error fetching public homepage stats', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch public stats',
        code: 'PUBLIC_STATS_FETCH_FAILED'
      },
      { status: 500 }
    );
  }
}
