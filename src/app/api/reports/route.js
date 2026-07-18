export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';

const errorResponse = (message, code, status = 500) =>
  NextResponse.json({ success: false, error: message, code }, { status });

const authErrorResponse = async (authError) => {
  const status = authError?.status || 401;
  const payload = await authError?.clone?.().json?.().catch(() => ({}));
  const message = payload?.error || 'Authentication required';
  const code = status === 403 ? 'FORBIDDEN' : status === 503 ? 'AUTH_SERVICE_UNAVAILABLE' : 'UNAUTHORIZED';
  return errorResponse(message, code, status);
};

const ALLOWED_REASONS = new Set([
  'Scam',
  'Incorrect Price',
  'Sold/Unavailable',
  'Offensive'
]);

const DESCRIPTION_MAX_LENGTH = 280;
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;
const ALLOWED_LISTING_TYPES = new Set([
  'property',
  'housemate',
  'noticeboard',
  'marketplace',
  'tradespeople',
  'service'
]);
const ALLOWED_COLLECTIONS = new Set([
  'properties',
  'housemate',
  'housemates',
  'noticeboard',
  'marketplace',
  'services',
  'tradespeople'
]);
const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]{2,120}$/;
const SAFE_SLUG_PATTERN = /^[A-Za-z0-9_-]{2,180}$/;

function sanitizeText(value, maxLength = 180) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function isValidOptionalUrl(value) {
  if (!value) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isSafeRelativePath(value) {
  if (!value) return true;
  return value.startsWith('/') && value.length <= 220 && !value.includes('..');
}

function normalizeReportLinkFields({ listingPath, listingUrl }) {
  const cleanPath = sanitizeText(listingPath, 220);
  const cleanUrl = sanitizeText(listingUrl, 300);

  // Older detail pages passed relative paths in listingUrl. Keep accepting them
  // as listingPath so live report submission does not fail.
  if (cleanUrl && cleanUrl.startsWith('/')) {
    return {
      listingPath: cleanPath || cleanUrl,
      listingUrl: ''
    };
  }

  return {
    listingPath: cleanPath,
    listingUrl: cleanUrl
  };
}

export async function POST(request) {
  try {
    let body = null;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Invalid JSON payload', 'INVALID_JSON_PAYLOAD', 400);
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return errorResponse('Payload must be a JSON object', 'INVALID_PAYLOAD_TYPE', 400);
    }

    const listingId = sanitizeText(body.listingId, 120);
    const listingTitle = sanitizeText(body.listingTitle, 160);
    const listingType = sanitizeText(body.listingType, 80).toLowerCase();
    const collectionName = sanitizeText(body.collectionName, 80).toLowerCase();
    const listingSlug = sanitizeText(body.listingSlug, 160);
    const {
      listingPath,
      listingUrl
    } = normalizeReportLinkFields({
      listingPath: body.listingPath,
      listingUrl: body.listingUrl
    });
    const reason = sanitizeText(body.reason, 60);
    const description = sanitizeText(body.description, DESCRIPTION_MAX_LENGTH);

    if (!listingId) {
      return errorResponse('listingId is required', 'LISTING_ID_REQUIRED', 400);
    }

    if (!SAFE_ID_PATTERN.test(listingId)) {
      return errorResponse('Invalid listingId format', 'INVALID_LISTING_ID', 400);
    }

    if (!reason || !ALLOWED_REASONS.has(reason)) {
      return errorResponse('Valid reason is required', 'INVALID_REASON', 400);
    }

    if (listingType && !ALLOWED_LISTING_TYPES.has(listingType)) {
      return errorResponse('Invalid listingType', 'INVALID_LISTING_TYPE', 400);
    }

    if (collectionName && !ALLOWED_COLLECTIONS.has(collectionName)) {
      return errorResponse('Invalid collectionName', 'INVALID_COLLECTION_NAME', 400);
    }

    if (listingSlug && !SAFE_SLUG_PATTERN.test(listingSlug)) {
      return errorResponse('Invalid listingSlug format', 'INVALID_LISTING_SLUG', 400);
    }

    if (!isSafeRelativePath(listingPath)) {
      return errorResponse('Invalid listingPath', 'INVALID_LISTING_PATH', 400);
    }

    if (!isValidOptionalUrl(listingUrl)) {
      return errorResponse('Invalid listingUrl', 'INVALID_LISTING_URL', 400);
    }

    const authHeader = request.headers.get('authorization');
    let reporterId = null;

    if (authHeader?.startsWith('Bearer ')) {
      const authResult = await verifyAuth(request);
      if (!authResult.success) {
        return authErrorResponse(authResult.error);
      }
      reporterId = authResult.userId;
    }

    const db = getAdminFirestore();

    if (reporterId) {
      const duplicateWindowStart = new Date(Date.now() - DUPLICATE_WINDOW_MS);
      const existingReportsSnapshot = await db
        .collection('listing_reports')
        .where('reporterId', '==', reporterId)
        .where('listingId', '==', listingId)
        .where('reason', '==', reason)
        .where('createdAt', '>=', duplicateWindowStart)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();
      if (!existingReportsSnapshot.empty) {
        return errorResponse('Duplicate report detected. Please wait before submitting again.', 'DUPLICATE_REPORT', 429);
      }
    }

    const now = new Date();
    const reportData = {
      listingId,
      listingTitle: listingTitle || 'Untitled Listing',
      listingType: listingType || null,
      collectionName: collectionName || null,
      listingSlug: listingSlug || null,
      listingPath: listingPath || null,
      listingUrl: listingUrl || null,
      reporterId,
      reason,
      description: description || null,
      status: 'pending',
      resolutionAction: null,
      resolvedAt: null,
      resolvedBy: null,
      timestamp: now,
      createdAt: now,
      updatedAt: now
    };

    const docRef = await db.collection('listing_reports').add(reportData);

    return NextResponse.json({
      success: true,
      id: docRef.id,
      message: 'Report submitted successfully.'
    });
  } catch (error) {
    console.error('Error creating listing report:', error);
    return errorResponse('Failed to create report.', 'REPORT_CREATE_FAILED', 500);
  }
}
