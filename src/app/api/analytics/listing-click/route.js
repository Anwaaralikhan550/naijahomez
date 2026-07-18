export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebase-admin';

const COLLECTION_MAP = {
  property: 'properties',
  properties: 'properties',
  marketplace: 'marketplace',
  market: 'marketplace',
  service: 'services',
  services: 'services',
  notice: 'noticeboard',
  noticeboard: 'noticeboard',
  housemate: 'housemates',
  housemates: 'housemates',
  tradesperson: 'tradespeople',
  tradespeople: 'tradespeople',
  trade: 'tradespeople',
  trades: 'tradespeople'
};

function resolveCollection(listingType) {
  if (!listingType || typeof listingType !== 'string') return null;
  return COLLECTION_MAP[listingType.trim().toLowerCase()] || null;
}

const errorResponse = (message, code, status = 500) =>
  NextResponse.json({ success: false, error: message, code }, { status });

export async function POST(request) {
  try {
    const body = await request.json();
    const listingId = body?.listingId;
    const listingType = body?.listingType;

    if (!listingId || typeof listingId !== 'string') {
      return errorResponse('Valid listingId is required', 'VALID_LISTING_ID_REQUIRED', 400);
    }

    const collectionName = resolveCollection(listingType);
    if (!collectionName) {
      return errorResponse('Unsupported listingType', 'UNSUPPORTED_LISTING_TYPE', 400);
    }

    const db = getAdminFirestore();
    const listingRef = db.collection(collectionName).doc(listingId.trim());

    await listingRef.update({
      clickCount: FieldValue.increment(1),
      lastInteractionAt: new Date(),
      updatedAt: new Date()
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const notFound = typeof error?.message === 'string' && error.message.includes('No document to update');
    if (notFound) {
      return errorResponse('Listing not found', 'LISTING_NOT_FOUND', 404);
    }

    return errorResponse('Failed to record click', 'CLICK_RECORD_FAILED', 500);
  }
}
