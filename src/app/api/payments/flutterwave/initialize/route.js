export const dynamic = 'force-dynamic';
import axios from 'axios';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import logger from '@/lib/logger';
import { FLUTTERWAVE_CONFIG, getPromotionPlanById } from '@/lib/pricingConfig';

const ALLOWED_COLLECTIONS = ['properties', 'marketplace', 'housemates', 'noticeboard', 'services'];

const errorResponse = (message, code, status = 500) =>
  NextResponse.json({ success: false, error: message, code }, { status });

const authErrorResponse = async (authError) => {
  const status = authError?.status || 401;
  const payload = await authError?.clone?.().json?.().catch(() => ({}));
  const message = payload?.error || 'Authentication required';
  const code = status === 403 ? 'FORBIDDEN' : status === 503 ? 'AUTH_SERVICE_UNAVAILABLE' : 'UNAUTHORIZED';
  return errorResponse(message, code, status);
};

const parseAmount = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const isValidCollection = (value) => ALLOWED_COLLECTIONS.includes(String(value || '').trim());

const findListing = async (db, listingId, userId, collectionName) => {
  if (collectionName) {
    const snapshot = await db.collection(collectionName).doc(listingId).get();
    if (!snapshot.exists) {
      return { error: 'Listing not found', status: 404 };
    }

    const listing = snapshot.data();
    if (listing?.userId !== userId) {
      return { error: 'You can only promote your own listing', status: 403 };
    }

    return { listing, collectionName };
  }

  for (const collection of ALLOWED_COLLECTIONS) {
    const snapshot = await db.collection(collection).doc(listingId).get();
    if (!snapshot.exists) {
      continue;
    }

    const listing = snapshot.data();
    if (listing?.userId !== userId) {
      return { error: 'You can only promote your own listing', status: 403 };
    }

    return { listing, collectionName: collection };
  }

  return { error: 'Listing not found in supported collections', status: 404 };
};

export async function POST(request) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authErrorResponse(authResult.error);
    }

    const body = await request.json();
    const listingId = String(body?.listingId || '').trim();
    const collectionName = body?.collectionName ? String(body.collectionName).trim() : '';
    const plan = getPromotionPlanById(body?.planId);
    const parsedAmount = parseAmount(body?.amount);
    const amount = parsedAmount === null ? plan.amount : parsedAmount;

    if (!listingId) {
      return errorResponse('listingId is required', 'LISTING_ID_REQUIRED', 400);
    }

    if (collectionName && !isValidCollection(collectionName)) {
      return errorResponse('Invalid collectionName supplied', 'INVALID_COLLECTION_NAME', 400);
    }

    if (amount === null || amount === undefined || amount < 0) {
      return errorResponse('Valid amount is required', 'VALID_AMOUNT_REQUIRED', 400);
    }

    if (!FLUTTERWAVE_CONFIG.secretKey) {
      logger.error('Flutterwave initialize blocked: missing secret key');
      return errorResponse('Payment provider is not configured. Contact support.', 'PAYMENT_PROVIDER_UNAVAILABLE', 503);
    }

    const db = getAdminFirestore();
    const listingResult = await findListing(db, listingId, authResult.userId, collectionName);
    if (listingResult.error) {
      const code =
        listingResult.status === 404 ? 'LISTING_NOT_FOUND' :
        listingResult.status === 403 ? 'FORBIDDEN' :
        'PAYMENT_LISTING_LOOKUP_FAILED';
      return errorResponse(listingResult.error, code, listingResult.status || 500);
    }

    const selectedCollection = listingResult.collectionName;
    const txRef = `promo_${selectedCollection}_${listingId}_${authResult.userId}_${Date.now()}`;

    if (amount === 0) {
      const now = new Date();
      const intentRef = db.collection('monetizationIntents').doc();
      await intentRef.set({
        userId: authResult.userId,
        userEmail: authResult.user?.email || null,
        listingId,
        collectionName: selectedCollection,
        intentType: 'promote_listing',
        planId: plan.id,
        expectedAmount: 0,
        currency: plan.currency || 'NGN',
        sourcePage: 'flutterwave_initialize_zero_fee',
        status: 'zero_fee_logged',
        txRef,
        createdAt: now,
        updatedAt: now
      });

      return NextResponse.json({
        success: true,
        zeroFee: true,
        intentId: intentRef.id,
        txRef,
        plan,
        listingId,
        collectionName: selectedCollection
      });
    }

    const redirectUrl =
      FLUTTERWAVE_CONFIG.redirectUrl ||
      `${request.nextUrl.origin}/dashboard?tab=my-ads&payment=flutterwave`;

    const payload = {
      tx_ref: txRef,
      amount,
      currency: plan.currency || 'NGN',
      redirect_url: redirectUrl,
      customer: {
        email: authResult.user?.email || 'no-email@naijahomz.local',
        name: authResult.user?.name || 'Naijahomz User'
      },
      customizations: {
        title: 'Naijahomz Listing Promotion',
        description: `Promotion payment for ${selectedCollection} listing`,
        logo: `${request.nextUrl.origin}/logo.png`
      },
      meta: {
        purpose: 'listing_promotion',
        listingId,
        collectionName: selectedCollection,
        userId: authResult.userId,
        planId: plan.id
      }
    };

    const response = await axios.post(`${FLUTTERWAVE_CONFIG.baseUrl}/payments`, payload, {
      headers: {
        Authorization: `Bearer ${FLUTTERWAVE_CONFIG.secretKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 20000
    });

    const paymentData = response?.data?.data || {};
    const paymentLink = paymentData?.link;

    if (!paymentLink) {
      logger.error('Flutterwave initialize response missing link', null, { response: response?.data });
      return errorResponse('Unable to create payment link at the moment', 'PAYMENT_LINK_UNAVAILABLE', 502);
    }

    return NextResponse.json({
      success: true,
      paymentLink,
      txRef,
      plan,
      listingId,
      collectionName: selectedCollection
    });
  } catch (error) {
    logger.error('Flutterwave initialize failed', error);
    const providerMessage =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      'Failed to initialize payment';
    return errorResponse(providerMessage, 'PAYMENT_INITIALIZE_FAILED', 500);
  }
}
