export const dynamic = 'force-dynamic';
import axios from 'axios';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import logger from '@/lib/logger';
import { FLUTTERWAVE_CONFIG, getPromotionPlanById } from '@/lib/pricingConfig';

const ALLOWED_COLLECTIONS = ['properties', 'marketplace', 'housemates', 'noticeboard', 'services'];
const IDEMPOTENCY_COLLECTION = 'paymentIdempotency';

const errorResponse = (message, code, status = 500) =>
  NextResponse.json({ success: false, error: message, code }, { status });

const isValidCollection = (value) => ALLOWED_COLLECTIONS.includes(String(value || '').trim());

const parseDateValue = (value) => {
  if (!value) return null;
  if (value?.toDate && typeof value.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getSignature = (request) => {
  return (
    request.headers.get('verif-hash') ||
    request.headers.get('x-flutterwave-signature') ||
    request.headers.get('flutterwave-signature') ||
    ''
  );
};

const resolveFromTxRef = (txRef) => {
  const value = String(txRef || '').trim();
  if (!value.startsWith('promo_')) return null;
  const parts = value.split('_');
  if (parts.length < 5) return null;
  return {
    collectionName: parts[1],
    listingId: parts[2]
  };
};

const verifyWithFlutterwave = async (transactionId) => {
  if (!transactionId || !FLUTTERWAVE_CONFIG.secretKey) return null;

  try {
    const response = await axios.get(
      `${FLUTTERWAVE_CONFIG.baseUrl}/transactions/${transactionId}/verify`,
      {
        headers: {
          Authorization: `Bearer ${FLUTTERWAVE_CONFIG.secretKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 20000
      }
    );
    return response?.data?.data || null;
  } catch (error) {
    logger.error('Flutterwave webhook verification call failed', error, { transactionId });
    return null;
  }
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

const resolveListingDocRef = async (db, listingId, collectionName) => {
  if (!listingId) return null;

  if (collectionName && isValidCollection(collectionName)) {
    const docRef = db.collection(collectionName).doc(listingId);
    const snapshot = await docRef.get();
    if (snapshot.exists) {
      return { docRef, listing: snapshot.data(), collectionName };
    }
  }

  for (const collection of ALLOWED_COLLECTIONS) {
    const docRef = db.collection(collection).doc(listingId);
    const snapshot = await docRef.get();
    if (snapshot.exists) {
      return { docRef, listing: snapshot.data(), collectionName: collection };
    }
  }

  return null;
};

export async function POST(request) {
  try {
    const signature = getSignature(request);
    if (FLUTTERWAVE_CONFIG.webhookSecretHash) {
      if (!signature || signature !== FLUTTERWAVE_CONFIG.webhookSecretHash) {
        logger.warn('Flutterwave webhook rejected: invalid or missing signature');
        return errorResponse('Invalid webhook signature', 'INVALID_WEBHOOK_SIGNATURE', 401);
      }
    }

    const body = await request.json();
    const event = String(body?.event || '').toLowerCase();
    const payloadData = body?.data || {};
    const providerStatus = String(payloadData?.status || '').toLowerCase();

    const successfulEvent =
      providerStatus === 'successful' &&
      (event === 'charge.completed' || event === 'payment.completed' || !event);

    if (!successfulEvent) {
      return NextResponse.json({ success: true, ignored: true, reason: 'event_not_successful' });
    }

    const providerTransactionId = String(payloadData?.id || '').trim();
    if (!providerTransactionId) {
      return NextResponse.json({ success: true, ignored: true, reason: 'missing_transaction_id' }, { status: 400 });
    }

    const serverVerified = await verifyWithFlutterwave(providerTransactionId);
    if (!serverVerified) {
      logger.warn('Flutterwave webhook rejected: provider verification failed', { providerTransactionId });
      return NextResponse.json({ success: true, ignored: true, reason: 'provider_verification_failed' }, { status: 400 });
    }

    const sourceData = serverVerified;
    const normalizedStatus = String(sourceData?.status || '').toLowerCase();
    if (normalizedStatus !== 'successful') {
      return NextResponse.json({ success: true, ignored: true, reason: 'provider_not_successful' });
    }

    const meta = sourceData?.meta || {};
    const txRef = sourceData?.tx_ref || '';
    const paymentType = String(meta?.paymentType || meta?.purpose || '').trim();

    if (paymentType === 'ad_campaign') {
      const adEngineModule = await import('@/lib/advertising/ad-engine');
      const adEngine = adEngineModule.default || adEngineModule;
      const result = await adEngine.verifyCampaignPayment({
        txRef,
        transactionId: providerTransactionId
      });
      return NextResponse.json({
        success: true,
        purpose: 'ad_campaign',
        campaignId: result.campaignId,
        txRef: result.txRef
      });
    }

    if (String(meta?.purpose || '').trim() && String(meta.purpose).trim() !== 'listing_promotion') {
      return NextResponse.json({ success: true, ignored: true, reason: 'invalid_purpose' }, { status: 400 });
    }

    const fallbackFromRef = resolveFromTxRef(txRef);
    const listingId = String(meta.listingId || fallbackFromRef?.listingId || '').trim();
    const collectionName = String(meta.collectionName || fallbackFromRef?.collectionName || '').trim();
    const plan = getPromotionPlanById(meta.planId || 'default');
    const resolvedTransactionId = String(sourceData?.id || providerTransactionId || '').trim();
    const idempotencyDocIds = buildIdempotencyDocIds(resolvedTransactionId, txRef);

    if (!listingId) {
      logger.warn('Flutterwave webhook ignored: missing listingId', { txRef });
      return NextResponse.json({ success: true, ignored: true, reason: 'missing_listing_id' });
    }

    if (!idempotencyDocIds.byTransactionId && !idempotencyDocIds.byTxRef) {
      return NextResponse.json({ success: true, ignored: true, reason: 'missing_payment_identity' }, { status: 400 });
    }

    const paidAmount = Number(sourceData?.amount || 0);
    const paidCurrency = String(sourceData?.currency || '').toUpperCase();

    if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
      return NextResponse.json({ success: true, ignored: true, reason: 'invalid_amount' });
    }

    if (paidCurrency && plan.currency && paidCurrency !== String(plan.currency).toUpperCase()) {
      return NextResponse.json({ success: true, ignored: true, reason: 'currency_mismatch' });
    }

    if (paidAmount < plan.amount) {
      return NextResponse.json({ success: true, ignored: true, reason: 'amount_too_low' });
    }

    const db = getAdminFirestore();
    const listingResult = await resolveListingDocRef(db, listingId, collectionName);
    if (!listingResult) {
      logger.warn('Flutterwave webhook ignored: listing not found', { listingId, collectionName });
      return NextResponse.json({ success: true, ignored: true, reason: 'listing_not_found' });
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
        throw new Error('Listing not found during webhook update');
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
          transactionId: resolvedTransactionId,
          txRef: String(sourceData?.tx_ref || txRef || ''),
          planId: plan.id,
          durationDays: plan.durationDays,
          verifiedAt: now.toISOString(),
          verifiedBy: 'webhook'
        },
        updatedAt: now
      });

      for (const idempotencyRef of idempotencyRefs) {
        transaction.set(idempotencyRef, {
          provider: 'flutterwave',
          source: 'webhook',
          transactionId: resolvedTransactionId,
          txRef: String(sourceData?.tx_ref || txRef || ''),
          listingId,
          collectionName: listingResult.collectionName,
          planId: plan.id,
          processedAt: now,
          promotionExpiry: promotionExpiry.toISOString()
        });
      }

      const transactionLogId = `flutterwave_${sanitizeIdempotencyValue(resolvedTransactionId || txRef)}`;
      transaction.set(db.collection('transactionLogs').doc(transactionLogId), {
        provider: 'flutterwave',
        source: 'webhook',
        transactionId: resolvedTransactionId,
        txRef: String(sourceData?.tx_ref || txRef || ''),
        userId: String(sourceData?.meta?.userId || ''),
        listingId,
        collectionName: listingResult.collectionName,
        planId: plan.id,
        amount: paidAmount,
        currency: paidCurrency || plan.currency,
        status: normalizedStatus,
        purpose: 'listing_promotion',
        rawProviderEventRef: providerTransactionId,
        createdAt: now,
        updatedAt: now
      }, { merge: true });

      return { alreadyProcessed: false, promotionExpiry: promotionExpiry.toISOString() };
    });

    if (transactionResult.alreadyProcessed) {
      return NextResponse.json({
        success: true,
        idempotent: true,
        listingId,
        collectionName: listingResult.collectionName,
        isPromoted: true,
        promotionExpiry: transactionResult.promotionExpiry || null
      });
    }

    return NextResponse.json({
      success: true,
      listingId,
      collectionName: listingResult.collectionName,
      isPromoted: true,
      promotionExpiry: transactionResult.promotionExpiry
    });
  } catch (error) {
    logger.error('Flutterwave webhook processing failed', error);
    return errorResponse('Failed to process webhook', 'WEBHOOK_PROCESS_FAILED', 500);
  }
}
