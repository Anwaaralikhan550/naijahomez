export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import { getAdminFirestore } from '@/lib/firebase-admin';

const ALLOWED_INTENTS = ['promote_listing', 'upgrade_plan', 'verify_agent'];
const ALLOWED_COLLECTIONS = ['properties', 'marketplace', 'housemates', 'noticeboard', 'services', 'tradespeople'];

function cleanString(value, maxLength = 180) {
  return String(value || '').trim().slice(0, maxLength);
}

export async function POST(request) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) return authResult.error;

    const body = await request.json().catch(() => ({}));
    const intentType = cleanString(body.intentType || 'promote_listing', 60);
    const collectionName = cleanString(body.collectionName, 80);
    const listingId = cleanString(body.listingId, 120);
    const expectedAmount = Number(body.expectedAmount || 0);

    if (!ALLOWED_INTENTS.includes(intentType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid monetization intent type.' },
        { status: 400 }
      );
    }

    if (collectionName && !ALLOWED_COLLECTIONS.includes(collectionName)) {
      return NextResponse.json(
        { success: false, error: 'Invalid collectionName.' },
        { status: 400 }
      );
    }

    if (!Number.isFinite(expectedAmount) || expectedAmount < 0) {
      return NextResponse.json(
        { success: false, error: 'expectedAmount must be zero or greater.' },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    const now = new Date();
    const docRef = db.collection('monetizationIntents').doc();

    await docRef.set({
      userId: authResult.userId,
      userEmail: authResult.user?.email || null,
      listingId: listingId || null,
      collectionName: collectionName || null,
      intentType,
      planId: cleanString(body.planId || 'zero_fee_interest', 80),
      expectedAmount,
      currency: cleanString(body.currency || 'NGN', 12),
      sourcePage: cleanString(body.sourcePage || request.headers.get('referer') || 'unknown', 500),
      status: expectedAmount === 0 ? 'zero_fee_logged' : 'interest_logged',
      createdAt: now,
      updatedAt: now
    });

    return NextResponse.json({
      success: true,
      intentId: docRef.id,
      zeroFee: expectedAmount === 0
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to log monetization intent' },
      { status: 500 }
    );
  }
}
