export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth-middleware';
import listingReportRepository from '@/lib/db/listing-report-repository.cjs';

const ALLOWED_QUEUE_STATUSES = new Set(['pending', 'resolved']);
const ALLOWED_ACTIONS = new Set(['dismiss', 'flag', 'hide', 'delete']);
const LISTING_STATUS_MAP = {
  flag: 'flagged',
  hide: 'hidden',
  delete: 'deleted'
};

const errorResponse = (message, code, status = 500) =>
  NextResponse.json({ success: false, error: message, code }, { status });

const authErrorResponse = async (authError) => {
  const status = authError?.status || 401;
  const payload = await authError?.clone?.().json?.().catch(() => ({}));
  const message = payload?.error || 'Authentication required';
  const code = status === 403 ? 'FORBIDDEN' : status === 503 ? 'AUTH_SERVICE_UNAVAILABLE' : 'UNAUTHORIZED';
  return errorResponse(message, code, status);
};

function sanitizeText(value, maxLength = 120) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function normalizeCollection(report) {
  const explicitCollection = sanitizeText(report?.collectionName, 80).toLowerCase();
  if (explicitCollection) return explicitCollection;

  const listingType = sanitizeText(report?.listingType, 80).toLowerCase();
  if (listingType === 'property' || listingType === 'properties') return 'properties';
  if (listingType === 'housemate' || listingType === 'housemates') return 'housemates';
  if (listingType === 'notice' || listingType === 'noticeboard') return 'noticeboard';
  if (listingType === 'marketplace' || listingType === 'market') return 'marketplace';
  if (listingType === 'tradespeople' || listingType === 'service' || listingType === 'services') return 'services';

  return null;
}

function getCandidateCollections(report) {
  const collectionName = normalizeCollection(report);
  const candidates = [];

  const add = (name) => {
    if (name && !candidates.includes(name)) candidates.push(name);
  };

  add(collectionName);

  if (collectionName === 'housemates' || collectionName === 'housemate') {
    add('housemates');
    add('housemate');
  }

  if (collectionName === 'services' || collectionName === 'tradespeople') {
    add('services');
    add('tradespeople');
  }

  return candidates;
}

async function findListingDoc(db, report, overrideListingId = '') {
  const candidateCollections = getCandidateCollections(report);
  if (candidateCollections.length === 0) {
    return { collectionName: null, docRef: null };
  }

  const preferredId = sanitizeText(overrideListingId || report?.listingId, 160);
  const slug = sanitizeText(report?.listingSlug, 160);

  for (const collectionName of candidateCollections) {
    const listingCollection = db.collection(collectionName);

    if (preferredId) {
      const byId = listingCollection.doc(preferredId);
      const byIdSnap = await byId.get();
      if (byIdSnap.exists) {
        return { collectionName, docRef: byId };
      }
    }

    if (slug) {
      const bySlugSnap = await listingCollection.where('slug', '==', slug).limit(1).get();
      if (!bySlugSnap.empty) {
        return { collectionName, docRef: bySlugSnap.docs[0].ref };
      }
    }
  }

  return { collectionName: candidateCollections[0], docRef: null };
}

export async function GET(request, { params }) {
  try {
    const adminResult = await isAdmin(request);
    if (!adminResult.success) {
      return authErrorResponse(adminResult.error);
    }

    const { id } = params;

    if (id === 'pending') {
      const url = new URL(request.url);
      const rawStatus = sanitizeText(url.searchParams.get('status') || 'pending', 40).toLowerCase();
      const status = ALLOWED_QUEUE_STATUSES.has(rawStatus) ? rawStatus : 'pending';

      const reports = await listingReportRepository.listReportsByStatus({ status, limit: 100 });

      return NextResponse.json({ success: true, reports });
    }

    const reportId = sanitizeText(id, 160);
    if (!reportId) {
      return errorResponse('Invalid report id', 'INVALID_REPORT_ID', 400);
    }

    const report = await listingReportRepository.getReportById(reportId);
    if (!report) {
      return errorResponse('Report not found', 'REPORT_NOT_FOUND', 404);
    }

    return NextResponse.json({ success: true, report });
  } catch (error) {
    console.error('GET /api/reports/[id] failed:', error);
    return errorResponse('Failed to fetch report data', 'REPORT_FETCH_FAILED', 500);
  }
}

export async function PATCH(request, { params }) {
  try {
    const adminResult = await isAdmin(request);
    if (!adminResult.success) {
      return authErrorResponse(adminResult.error);
    }

    const { id } = params;
    const reportId = sanitizeText(id, 160);
    if (!reportId || reportId === 'pending') {
      return errorResponse('Invalid report id', 'INVALID_REPORT_ID', 400);
    }

    let body = null;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Invalid JSON payload', 'INVALID_JSON_PAYLOAD', 400);
    }

    const action = sanitizeText(body?.action, 20).toLowerCase();
    if (!ALLOWED_ACTIONS.has(action)) {
      return errorResponse('Invalid moderation action', 'INVALID_MODERATION_ACTION', 400);
    }

    const reportData = await listingReportRepository.getReportById(reportId);
    if (!reportData) {
      return errorResponse('Report not found', 'REPORT_NOT_FOUND', 404);
    }

    const now = new Date();

    if (action === 'dismiss') {
      await listingReportRepository.resolveReport(reportId, {
        resolutionAction: action,
        resolvedBy: adminResult.userId || null
      });
      return NextResponse.json({ success: true, message: 'Report dismissed' });
    }

    // Report (Postgres) and listing (Firestore-shim) live in separate
    // backends now, so this can no longer be one atomic transaction.
    // Listing update runs first since it's the side effect; if the report
    // update below fails, retrying is safe (the listing write is idempotent).
    const db = getAdminFirestore();
    const { collectionName, docRef } = await findListingDoc(
      db,
      reportData,
      sanitizeText(body?.listingId, 160)
    );

    if (!collectionName) {
      return errorResponse('Unable to determine listing collection', 'LISTING_COLLECTION_UNAVAILABLE', 400);
    }

    if (!docRef) {
      return errorResponse('Target listing not found. Please verify listing ID/slug.', 'TARGET_LISTING_NOT_FOUND', 404);
    }

    const mappedStatus = LISTING_STATUS_MAP[action] || 'flagged';
    const listingSnap = await docRef.get();
    if (!listingSnap.exists) {
      return errorResponse('Target listing not found. Please verify listing ID/slug.', 'TARGET_LISTING_NOT_FOUND', 404);
    }

    await docRef.update({
      status: mappedStatus,
      moderationStatus: action === 'flag' ? 'flagged' : mappedStatus,
      flaggedBy: adminResult.userId || null,
      flaggedAt: now,
      updatedAt: now
    });

    await listingReportRepository.resolveReport(reportId, {
      resolutionAction: action,
      resolvedBy: adminResult.userId || null,
      listingAction: action,
      listingStatusAfterAction: mappedStatus
    });

    return NextResponse.json({
      success: true,
      message: 'Report resolved and listing updated',
      listingStatus: mappedStatus
    });
  } catch (error) {
    console.error('PATCH /api/reports/[id] failed:', error);
    return errorResponse('Failed to resolve report', 'REPORT_RESOLVE_FAILED', 500);
  }
}
