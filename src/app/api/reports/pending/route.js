export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth-middleware';

const ALLOWED_QUEUE_STATUSES = new Set(['pending', 'resolved']);

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

function toIso(value) {
  if (!value) return null;
  if (value?.toDate && typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value?.seconds) return new Date(value.seconds * 1000).toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function mapReportDocument(doc) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    ...data,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
    resolvedAt: toIso(data.resolvedAt)
  };
}

export async function GET(request) {
  try {
    const adminResult = await isAdmin(request);
    if (!adminResult.success) {
      return authErrorResponse(adminResult.error);
    }

    const url = new URL(request.url);
    const rawStatus = sanitizeText(url.searchParams.get('status') || 'pending', 40).toLowerCase();
    const status = ALLOWED_QUEUE_STATUSES.has(rawStatus) ? rawStatus : 'pending';
    const rawLimit = Number(url.searchParams.get('limit') || 100);
    const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? rawLimit : 100, 200));

    const db = getAdminFirestore();
    const queueSnap = await db
      .collection('listing_reports')
      .where('status', '==', status)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return NextResponse.json({
      success: true,
      status,
      reports: queueSnap.docs.map(mapReportDocument),
      count: queueSnap.size
    });
  } catch (error) {
    console.error('GET /api/reports/pending failed:', error);
    return errorResponse('Failed to fetch pending reports', 'REPORTS_PENDING_FETCH_FAILED', 500);
  }
}
