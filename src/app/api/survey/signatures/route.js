export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import logger from '@/lib/logger';

const errorResponse = (message, code, status = 500) =>
  NextResponse.json({ success: false, error: message, code }, { status });

const authErrorResponse = async (authError) => {
  const status = authError?.status || 401;
  const payload = await authError?.clone?.().json?.().catch(() => ({}));
  const message = payload?.error || 'Authentication required';
  const code = status === 403 ? 'FORBIDDEN' : status === 503 ? 'AUTH_SERVICE_UNAVAILABLE' : 'UNAUTHORIZED';
  return errorResponse(message, code, status);
};

/**
 * Survey Signatures API
 *
 * Architecture:
 *   Signatures are stored as a SUB-COLLECTION under each survey document:
 *
 *     surveys/{surveyId}/signatures/{signatureId}
 *
 *   Each document in the sub-collection is ONE signature with:
 *     - id          (auto-generated Firestore doc ID)
 *     - imageData   (base64 PNG data-url)
 *     - label       (human-readable label)
 *     - createdBy   (authenticated user ID)
 *     - createdAt   (server timestamp)
 *
 *   WHY a sub-collection instead of an array field?
 *     1. Firestore documents have a 1 MiB limit. Base64 images are large.
 *        An array of 10+ signatures could exceed the limit.
 *     2. Sub-collection allows atomic add / delete without read-modify-write
 *        race conditions on the parent document.
 *     3. Pagination is trivial with sub-collection queries.
 *
 *   BACKWARD COMPATIBILITY:
 *     If a survey document has the old `signatureData` string field,
 *     the GET handler auto-migrates it into the sub-collection on first read
 *     and clears the legacy field.
 */

// ── GET — Fetch all signatures for a survey ──────────────────────
export async function GET(request) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) return authErrorResponse(authResult.error);

    const userId = authResult.userId;
    const { searchParams } = new URL(request.url);
    const surveyId = searchParams.get('surveyId');

    if (!surveyId) {
      return errorResponse('surveyId is required', 'SURVEY_ID_REQUIRED', 400);
    }

    const db = getAdminFirestore();
    const surveyRef = db.collection('surveys').doc(surveyId);
    const surveySnap = await surveyRef.get();

    if (!surveySnap.exists) {
      return errorResponse('Survey not found', 'SURVEY_NOT_FOUND', 404);
    }

    // Ownership check
    const surveyData = surveySnap.data();
    if (surveyData.userId !== userId) {
      return errorResponse('Forbidden', 'FORBIDDEN', 403);
    }

    // ── Backward-compat migration ─────────────────────────────
    if (surveyData.signatureData && typeof surveyData.signatureData === 'string') {
      const migratedRef = surveyRef.collection('signatures').doc();
      await migratedRef.set({
        imageData: surveyData.signatureData,
        label: 'Migrated signature',
        createdBy: userId,
        createdAt: new Date(),
      });
      // Clear the legacy field so migration runs only once
      await surveyRef.update({ signatureData: null });
      logger.info(`Migrated legacy signature for survey ${surveyId}`);
    }

    // ── Fetch sub-collection ──────────────────────────────────
    const signaturesSnap = await surveyRef
      .collection('signatures')
      .orderBy('createdAt', 'asc')
      .get();

    const signatures = signaturesSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
    }));

    return NextResponse.json({ success: true, data: signatures });
  } catch (error) {
    logger.error('Error fetching survey signatures', error);
    return errorResponse('Failed to fetch signatures', 'SURVEY_SIGNATURES_FETCH_FAILED', 500);
  }
}

// ── POST — Add a new signature (APPEND, never overwrite) ─────────
export async function POST(request) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) return authErrorResponse(authResult.error);

    const userId = authResult.userId;
    const body = await request.json();
    const { surveyId, imageData, label } = body;

    if (!surveyId || !imageData) {
      return errorResponse('surveyId and imageData are required', 'SURVEY_SIGNATURE_FIELDS_REQUIRED', 400);
    }

    // Basic validation — imageData must look like a data-url
    if (!imageData.startsWith('data:image/')) {
      return errorResponse('imageData must be a valid base64 image data-url', 'INVALID_SIGNATURE_IMAGE_DATA', 400);
    }

    // Cap at ~2 MB per signature to stay well within Firestore doc limits
    if (imageData.length > 2 * 1024 * 1024) {
      return errorResponse('Signature image too large (max 2 MB)', 'SIGNATURE_TOO_LARGE', 400);
    }

    const db = getAdminFirestore();
    const surveyRef = db.collection('surveys').doc(surveyId);
    const surveySnap = await surveyRef.get();

    if (!surveySnap.exists) {
      return errorResponse('Survey not found', 'SURVEY_NOT_FOUND', 404);
    }

    if (surveySnap.data().userId !== userId) {
      return errorResponse('Forbidden', 'FORBIDDEN', 403);
    }

    // Cap total signatures per survey
    const existingCount = (await surveyRef.collection('signatures').count().get()).data().count;
    if (existingCount >= 20) {
      return errorResponse('Maximum 20 signatures per survey reached', 'SIGNATURE_LIMIT_REACHED', 400);
    }

    // APPEND — create a new doc in the sub-collection
    const sigRef = surveyRef.collection('signatures').doc();
    const signatureData = {
      imageData,
      label: (label || '').trim().substring(0, 80) || `Signature #${existingCount + 1}`,
      createdBy: userId,
      createdAt: new Date(),
    };

    await sigRef.set(signatureData);

    return NextResponse.json(
      {
        success: true,
        data: {
          id: sigRef.id,
          ...signatureData,
          createdAt: signatureData.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Error saving survey signature', error);
    return errorResponse('Failed to save signature', 'SURVEY_SIGNATURE_SAVE_FAILED', 500);
  }
}

// ── DELETE — Remove a single signature by ID ─────────────────────
export async function DELETE(request) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) return authErrorResponse(authResult.error);

    const userId = authResult.userId;
    const { searchParams } = new URL(request.url);
    const surveyId = searchParams.get('surveyId');
    const signatureId = searchParams.get('signatureId');

    if (!surveyId || !signatureId) {
      return errorResponse('surveyId and signatureId are required', 'SURVEY_SIGNATURE_DELETE_FIELDS_REQUIRED', 400);
    }

    const db = getAdminFirestore();
    const surveyRef = db.collection('surveys').doc(surveyId);
    const surveySnap = await surveyRef.get();

    if (!surveySnap.exists) {
      return errorResponse('Survey not found', 'SURVEY_NOT_FOUND', 404);
    }

    if (surveySnap.data().userId !== userId) {
      return errorResponse('Forbidden', 'FORBIDDEN', 403);
    }

    const sigRef = surveyRef.collection('signatures').doc(signatureId);
    const sigSnap = await sigRef.get();

    if (!sigSnap.exists) {
      return errorResponse('Signature not found', 'SIGNATURE_NOT_FOUND', 404);
    }

    await sigRef.delete();

    return NextResponse.json({ success: true, message: 'Signature deleted' });
  } catch (error) {
    logger.error('Error deleting survey signature', error);
    return errorResponse('Failed to delete signature', 'SURVEY_SIGNATURE_DELETE_FAILED', 500);
  }
}
