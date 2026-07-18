export const dynamic = 'force-dynamic';
import axios from 'axios';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import logger from '@/lib/logger';
import { FLUTTERWAVE_CONFIG, getPromotionPlanById } from '@/lib/pricingConfig';

const ALLOWED_COLLECTIONS = ['properties', 'marketplace', 'housemates', 'noticeboard', 'services'];
const IDEMPOTENCY_COLLECTION = 'paymentIdempotency';

const errorResponse = (message, code, status = 500) =>
  NextResponse.json({ success: false, error: message, code }, { status });

const authErrorResponse = async (authError) => {
  const status = authError?.status || 401;
  const payload = await authError?.clone?.().json?.().catch(() => ({}));
  const message = payload?.error || 'Authentication required';
  const code = status === 403 ? 'FORBIDDEN' : status === 503 ? 'AUTH_SERVICE_UNAVAILABLE' : 'UNAUTHORIZED';
  return errorResponse(message, code, status);
};

const isValidCollection = (value) => ALLOWED_COLLECTIONS.includes(String(value || '').trim());

const parseDateValue = (value) => {
  if (!value) return null;
  if (value?.toDate && typeof value.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const parseTransactionParams = (searchParams) => {
  return {
    transactionId:
      searchParams.get('transaction_id') ||
      searchParams.get('transactionId') ||
      searchParams.get('id'),
    txRef: searchParams.get('tx_ref') || searchParams.get('txRef'),
    listingId: searchParams.get('listingId'),
    collectionName: searchParams.get('collectionName'),
    planId: searchParams.get('planId')
  };
};

const resolveFromTxRef = (txRef) => {
  const value = String(txRef || '').trim();
  if (!value.startsWith('promo_')) return null;
  const parts = value.split('_');
  if (parts.length < 5) return null;

  return {
    collectionName: parts[1],
    listingId: parts[2],
    userId: parts[3]
  };
};

const sanitizeIdempotencyValue = (value) => String(value || '').trim().replace(/[^a-zA-Z0-9:_-]/g, '_').slice(0, 220);

const buildIdempotencyDocIds = (transactionId, txRef) => {
  const normalizedTransactionId = String(transactionId || '').trim();
  const normalizedTxRef = String(txRef || '').trim();

  return {
    byTransactionId: normalizedTransactionId ? `flutterwave_txid_${sanitizeIdempotencyValue(normalizedTransactionId)}` : null,
    byTxRef: normalizedTxRef ? `flutterwave_txref_${sanitizeIdempotencyValue(normalizedTxRef)}` : null
  };
};

const verifyWithFlutterwave = async ({ transactionId, txRef }) => {
  if (!FLUTTERWAVE_CONFIG.secretKey) {
    throw new Error('Flutterwave secret key is not configured');
  }

  if (!transactionId && !txRef) {
    throw new Error('transaction_id or tx_ref is required');
  }

  const endpoint = transactionId
    ? `${FLUTTERWAVE_CONFIG.baseUrl}/transactions/${transactionId}/verify`
    : `${FLUTTERWAVE_CONFIG.baseUrl}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`;

  const response = await axios.get(endpoint, {
    headers: {
      Authorization: `Bearer ${FLUTTERWAVE_CONFIG.secretKey}`,
      'Content-Type': 'application/json'
    },
    timeout: 20000
  });

  return response?.data?.data || null;
};

const findListing = async (db, listingId, userId, collectionName) => {
  if (!listingId) {
    return { error: 'Unable to resolve listingId for promotion' };
  }

  if (collectionName) {
    if (!isValidCollection(collectionName)) {
      return { error: 'Invalid collectionName supplied' };
    }

    const docRef = db.collection(collectionName).doc(listingId);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      return { error: 'Listing not found' };
    }

    const listing = snapshot.data();
    if (listing?.userId !== userId) {
      return { error: 'You can only verify promotion for your own listing' };
    }

    return { docRef, listing, collectionName };
  }

  for (const collection of ALLOWED_COLLECTIONS) {
    const docRef = db.collection(collection).doc(listingId);
    const snapshot = await docRef.get();
    if (!snapshot.exists) continue;

    const listing = snapshot.data();
    if (listing?.userId !== userId) {
      return { error: 'You can only verify promotion for your own listing' };
    }

    return { docRef, listing, collectionName: collection };
  }

  return { error: 'Listing not found in supported collections' };
};

export async function GET(request) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authErrorResponse(authResult.error);
    }

    const { searchParams } = new URL(request.url);
    const { transactionId, txRef, listingId: qpListingId, collectionName: qpCollectionName, planId: qpPlanId } =
      parseTransactionParams(searchParams);

    const flutterwaveData = await verifyWithFlutterwave({ transactionId, txRef });

    if (!flutterwaveData) {
      return errorResponse('Transaction verification returned no payload', 'PAYMENT_VERIFICATION_EMPTY', 502);
    }

    const normalizedStatus = String(flutterwaveData?.status || '').toLowerCase();
    if (normalizedStatus !== 'successful') {
      return errorResponse(
        `Payment is not successful${flutterwaveData?.status ? `: ${flutterwaveData.status}` : ''}`,
        'PAYMENT_NOT_SUCCESSFUL',
        400
      );
    }

    const metadata = flutterwaveData?.meta || {};
    const providerTxRef = String(flutterwaveData?.tx_ref || txRef || '').trim();
    const txRefParts = resolveFromTxRef(providerTxRef);
    const providerTransactionId = String(flutterwaveData?.id || transactionId || '').trim();

    const purpose = String(metadata?.purpose || '').trim();
    if (purpose !== 'listing_promotion') {
      return errorResponse('Invalid payment purpose metadata', 'PAYMENT_PURPOSE_INVALID', 400);
    }

    const metadataUserId = String(metadata?.userId || '').trim();
    if (!metadataUserId || metadataUserId !== authResult.userId) {
      return errorResponse('Payment metadata user mismatch', 'PAYMENT_USER_MISMATCH', 403);
    }

    const metadataListingId = String(metadata?.listingId || '').trim();
    const metadataCollectionName = String(metadata?.collectionName || metadata?.collection || '').trim();
    if (!metadataListingId) {
      return errorResponse('Missing listingId in payment metadata', 'PAYMENT_METADATA_LISTING_ID_REQUIRED', 400);
    }

    if (!metadataCollectionName || !isValidCollection(metadataCollectionName)) {
      return errorResponse('Invalid collection in payment metadata', 'PAYMENT_METADATA_COLLECTION_INVALID', 400);
    }

    if (txRefParts?.userId && String(txRefParts.userId).trim() !== metadataUserId) {
      return errorResponse('tx_ref user does not match payment metadata', 'PAYMENT_TXREF_USER_MISMATCH', 400);
    }

    if (txRefParts?.listingId && String(txRefParts.listingId).trim() !== metadataListingId) {
      return errorResponse('tx_ref listingId does not match payment metadata', 'PAYMENT_TXREF_LISTING_MISMATCH', 400);
    }

    if (
      txRefParts?.collectionName &&
      String(txRefParts.collectionName).trim() !== metadataCollectionName
    ) {
      return errorResponse('tx_ref collection does not match payment metadata', 'PAYMENT_TXREF_COLLECTION_MISMATCH', 400);
    }

    const resolvedListingId = metadataListingId;
    const resolvedCollectionName = metadataCollectionName;
    const resolvedPlanId = String(metadata.planId || qpPlanId || 'default').trim();

    if (qpListingId && String(qpListingId).trim() !== resolvedListingId) {
      return errorResponse('listingId does not match verified payment metadata', 'PAYMENT_QUERY_LISTING_MISMATCH', 400);
    }

    if (qpCollectionName && String(qpCollectionName).trim() !== resolvedCollectionName) {
      return errorResponse('collectionName does not match verified payment metadata', 'PAYMENT_QUERY_COLLECTION_MISMATCH', 400);
    }

    if (qpPlanId && String(qpPlanId).trim() !== resolvedPlanId) {
      return errorResponse('planId does not match verified payment metadata', 'PAYMENT_QUERY_PLAN_MISMATCH', 400);
    }

    const idempotencyDocIds = buildIdempotencyDocIds(providerTransactionId, providerTxRef);
    if (!idempotencyDocIds.byTransactionId && !idempotencyDocIds.byTxRef) {
      return errorResponse('Unable to derive payment idempotency key', 'PAYMENT_IDEMPOTENCY_KEY_UNAVAILABLE', 400);
    }

    const plan = getPromotionPlanById(resolvedPlanId);

    const paidAmount = Number(flutterwaveData?.amount || 0);
    const paidCurrency = String(flutterwaveData?.currency || '').toUpperCase();

    if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
      return errorResponse('Invalid payment amount from provider', 'PAYMENT_AMOUNT_INVALID', 400);
    }

    if (paidCurrency && plan.currency && paidCurrency !== String(plan.currency).toUpperCase()) {
      return errorResponse('Payment currency mismatch', 'PAYMENT_CURRENCY_MISMATCH', 400);
    }

    if (paidAmount < plan.amount) {
      return errorResponse('Payment amount is lower than promotion plan amount', 'PAYMENT_AMOUNT_TOO_LOW', 400);
    }

    const db = getAdminFirestore();
    const listingResult = await findListing(
      db,
      resolvedListingId,
      authResult.userId,
      resolvedCollectionName || undefined
    );

    if (listingResult.error) {
      return errorResponse(listingResult.error, 'LISTING_NOT_FOUND', 404);
    }

    const now = new Date();
    const idempotencyRefs = [
      idempotencyDocIds.byTransactionId
        ? db.collection(IDEMPOTENCY_COLLECTION).doc(idempotencyDocIds.byTransactionId)
        : null,
      idempotencyDocIds.byTxRef ? db.collection(IDEMPOTENCY_COLLECTION).doc(idempotencyDocIds.byTxRef) : null
    ].filter(Boolean);

    const transactionResult = await db.runTransaction(async (transaction) => {
      for (const idempotencyRef of idempotencyRefs) {
        const processedSnapshot = await transaction.get(idempotencyRef);
        if (processedSnapshot.exists) {
          return { alreadyProcessed: true, promotionExpiry: processedSnapshot.data()?.promotionExpiry || null };
        }
      }

      const listingSnapshot = await transaction.get(listingResult.docRef);
      if (!listingSnapshot.exists) {
        throw new Error('Listing not found during promotion update');
      }

      const listingData = listingSnapshot.data() || {};
      const previousExpiry = parseDateValue(listingData?.promotionExpiry);
      const startFrom = previousExpiry && previousExpiry > now ? previousExpiry : now;
      const promotionExpiry = new Date(startFrom.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

      transaction.update(listingResult.docRef, {
        isPromoted: true,
        promotionPlanId: plan.id,
        promotionStartedAt: now,
        promotionExpiry,
        promotionMeta: {
          provider: 'flutterwave',
          status: normalizedStatus,
          amount: paidAmount,
          currency: paidCurrency || plan.currency,
          transactionId: providerTransactionId,
          txRef: providerTxRef,
          planId: plan.id,
          durationDays: plan.durationDays,
          verifiedAt: now.toISOString(),
          verifiedBy: 'user-verify'
        },
        updatedAt: now
      });

      for (const idempotencyRef of idempotencyRefs) {
        transaction.set(idempotencyRef, {
          provider: 'flutterwave',
          source: 'verify',
          transactionId: providerTransactionId,
          txRef: providerTxRef,
          listingId: resolvedListingId,
          collectionName: listingResult.collectionName,
          userId: authResult.userId,
          planId: plan.id,
          processedAt: now,
          promotionExpiry: promotionExpiry.toISOString()
        });
      }

      const transactionLogId = `flutterwave_${sanitizeIdempotencyValue(providerTransactionId || providerTxRef)}`;
      transaction.set(db.collection('transactionLogs').doc(transactionLogId), {
        provider: 'flutterwave',
        source: 'user-verify',
        transactionId: providerTransactionId,
        txRef: providerTxRef,
        userId: authResult.userId,
        listingId: resolvedListingId,
        collectionName: listingResult.collectionName,
        planId: plan.id,
        amount: paidAmount,
        currency: paidCurrency || plan.currency,
        status: normalizedStatus,
        purpose: 'listing_promotion',
        rawProviderEventRef: providerTransactionId || providerTxRef,
        createdAt: now,
        updatedAt: now
      }, { merge: true });

      return { alreadyProcessed: false, promotionExpiry: promotionExpiry.toISOString() };
    });

    if (transactionResult.alreadyProcessed) {
      return NextResponse.json({
        success: true,
        idempotent: true,
        listingId: resolvedListingId,
        collectionName: listingResult.collectionName,
        isPromoted: true,
        promotionExpiry: transactionResult.promotionExpiry,
        transactionId: providerTransactionId,
        txRef: providerTxRef
      });
    }

    return NextResponse.json({
      success: true,
      listingId: resolvedListingId,
      collectionName: listingResult.collectionName,
      isPromoted: true,
      promotionExpiry: transactionResult.promotionExpiry,
      transactionId: providerTransactionId,
      txRef: providerTxRef
    });
  } catch (error) {
    logger.error('Flutterwave verify failed', error);
    const providerMessage =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.message ||
      'Failed to verify payment';
    return errorResponse(providerMessage, 'PAYMENT_VERIFY_FAILED', 500);
  }
}
