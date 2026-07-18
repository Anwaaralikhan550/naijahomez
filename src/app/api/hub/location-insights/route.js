export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth-middleware';

function errorResponse(message, code = 'INTERNAL_ERROR', status = 500) {
  return NextResponse.json({ success: false, error: message, code }, { status });
}

async function authFailureResponse(authError, fallbackCode = 'UNAUTHORIZED') {
  const status = authError?.status || 401;
  let message = status === 403 ? 'Forbidden' : status === 503 ? 'Authentication service unavailable' : 'Unauthorized';

  try {
    const payload = await authError.clone().json();
    if (typeof payload?.error === 'string' && payload.error.trim()) {
      message = payload.error;
    }
  } catch {
    // Keep fallback message.
  }

  const code =
    status === 401 ? 'UNAUTHORIZED' :
    status === 403 ? 'FORBIDDEN' :
    status === 404 ? 'NOT_FOUND' :
    status === 503 ? 'SERVICE_UNAVAILABLE' :
    fallbackCode;

  return errorResponse(message, code, status);
}



const LISTING_COLLECTIONS = ['properties', 'marketplace'];

function normalizeText(value) {
  if (!value || typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ');
}

function isActiveListing(data) {
  if (!data || typeof data !== 'object') return false;

  if (data.isDeleted === true || data.deletedAt) return false;

  const status = normalizeText(String(data.status || '')).toLowerCase();
  if (['deleted', 'inactive', 'archived', 'rejected', 'removed'].includes(status)) {
    return false;
  }

  if (data.isActive === false) return false;
  return true;
}

function extractState(data) {
  return normalizeText(
    data?.state ||
      data?.address?.state ||
      data?.address?.region ||
      data?.region ||
      ''
  );
}

function extractLocation(data) {
  return normalizeText(
    data?.location ||
      data?.address?.city ||
      data?.city ||
      data?.town ||
      data?.address?.town ||
      ''
  );
}

function titleCase(value) {
  return value
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export async function GET(request) {
  try {
    const adminResult = await isAdmin(request);
    if (!adminResult.success) {
      return authFailureResponse(adminResult.error, 'FORBIDDEN');
    }

    const db = getAdminFirestore();
    const counts = new Map();
    const collectionTotals = {};
    let totalActiveListings = 0;

    const snapshots = await Promise.all(
      LISTING_COLLECTIONS.map((collectionName) => db.collection(collectionName).get())
    );

    snapshots.forEach((snapshot, index) => {
      const collectionName = LISTING_COLLECTIONS[index];
      let activeInCollection = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        if (!isActiveListing(data)) return;

        const state = extractState(data) || 'Unknown';
        const location = extractLocation(data) || 'Unknown';
        const key = `${state.toLowerCase()}::${location.toLowerCase()}`;

        const prev = counts.get(key) || {
          state: titleCase(state),
          location: titleCase(location),
          count: 0
        };
        prev.count += 1;
        counts.set(key, prev);

        activeInCollection += 1;
        totalActiveListings += 1;
      });

      collectionTotals[collectionName] = activeInCollection;
    });

    const insights = Array.from(counts.values()).sort((a, b) => b.count - a.count);

    return NextResponse.json({
      success: true,
      insights,
      totals: {
        totalActiveListings,
        byCollection: collectionTotals
      },
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    return errorResponse('Failed to load location insights', 'INTERNAL_ERROR', 500);
  }
}
