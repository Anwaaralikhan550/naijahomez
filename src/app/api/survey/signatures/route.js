import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import logger from '@/lib/logger';

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
    if (!authResult.success) return authResult.error;

    const userId = authResult.userId;
    const { searchParams } = new URL(request.url);
    const surveyId = searchParams.get('surveyId');

    if (!surveyId) {
      return NextResponse.json({ error: 'surveyId is required' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const surveyRef = db.collection('surveys').doc(surveyId);
    const surveySnap = await surveyRef.get();

    if (!surveySnap.exists) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
    }

    // Ownership check
    const surveyData = surveySnap.data();
    if (surveyData.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
    return NextResponse.json({ error: 'Failed to fetch signatures' }, { status: 500 });
  }
}

// ── POST — Add a new signature (APPEND, never overwrite) ─────────
export async function POST(request) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) return authResult.error;

    const userId = authResult.userId;
    const body = await request.json();
    const { surveyId, imageData, label } = body;

    if (!surveyId || !imageData) {
      return NextResponse.json(
        { error: 'surveyId and imageData are required' },
        { status: 400 }
      );
    }

    // Basic validation — imageData must look like a data-url
    if (!imageData.startsWith('data:image/')) {
      return NextResponse.json(
        { error: 'imageData must be a valid base64 image data-url' },
        { status: 400 }
      );
    }

    // Cap at ~2 MB per signature to stay well within Firestore doc limits
    if (imageData.length > 2 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Signature image too large (max 2 MB)' },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    const surveyRef = db.collection('surveys').doc(surveyId);
    const surveySnap = await surveyRef.get();

    if (!surveySnap.exists) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
    }

    if (surveySnap.data().userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Cap total signatures per survey
    const existingCount = (await surveyRef.collection('signatures').count().get()).data().count;
    if (existingCount >= 20) {
      return NextResponse.json(
        { error: 'Maximum 20 signatures per survey reached' },
        { status: 400 }
      );
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
    return NextResponse.json({ error: 'Failed to save signature' }, { status: 500 });
  }
}

// ── DELETE — Remove a single signature by ID ─────────────────────
export async function DELETE(request) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) return authResult.error;

    const userId = authResult.userId;
    const { searchParams } = new URL(request.url);
    const surveyId = searchParams.get('surveyId');
    const signatureId = searchParams.get('signatureId');

    if (!surveyId || !signatureId) {
      return NextResponse.json(
        { error: 'surveyId and signatureId are required' },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    const surveyRef = db.collection('surveys').doc(surveyId);
    const surveySnap = await surveyRef.get();

    if (!surveySnap.exists) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
    }

    if (surveySnap.data().userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sigRef = surveyRef.collection('signatures').doc(signatureId);
    const sigSnap = await sigRef.get();

    if (!sigSnap.exists) {
      return NextResponse.json({ error: 'Signature not found' }, { status: 404 });
    }

    await sigRef.delete();

    return NextResponse.json({ success: true, message: 'Signature deleted' });
  } catch (error) {
    logger.error('Error deleting survey signature', error);
    return NextResponse.json({ error: 'Failed to delete signature' }, { status: 500 });
  }
}
