import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import logger from '@/lib/logger';

/**
 * Survey Reports API — Firestore metadata layer for generated PDFs.
 *
 * Architecture:
 *   The actual PDF blob is stored in the client's IndexedDB (local-first).
 *   This API stores lightweight metadata so reports survive across devices
 *   and provide a cloud-synced history.
 *
 *   Collection: surveyReports/{reportId}
 *     - surveyId        (string)
 *     - title           (string)
 *     - filename         (string)
 *     - version          (number, auto-incremented per survey)
 *     - sizeBytes        (number)
 *     - signatureCount   (number)
 *     - createdBy        (userId)
 *     - createdAt        (timestamp)
 *
 *   No blob is stored here — Firestore's 1 MiB doc limit makes that
 *   impractical. The blob lives in IndexedDB on the originating device.
 */

// ── GET — List all reports for a survey (or all user reports) ────
export async function GET(request) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) return authResult.error;

    const userId = authResult.userId;
    const { searchParams } = new URL(request.url);
    const surveyId = searchParams.get('surveyId');

    const db = getAdminFirestore();

    let query = db
      .collection('surveyReports')
      .where('createdBy', '==', userId)
      .orderBy('createdAt', 'desc');

    if (surveyId) {
      query = db
        .collection('surveyReports')
        .where('createdBy', '==', userId)
        .where('surveyId', '==', surveyId)
        .orderBy('createdAt', 'desc');
    }

    const snapshot = await query.limit(100).get();

    const reports = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
    }));

    return NextResponse.json({ success: true, data: reports });
  } catch (error) {
    logger.error('Error fetching survey reports', error);
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
  }
}

// ── POST — Register a new PDF report ─────────────────────────────
export async function POST(request) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) return authResult.error;

    const userId = authResult.userId;
    const body = await request.json();
    const { id, surveyId, title, filename, version, sizeBytes, signatureCount } = body;

    if (!id || !surveyId || !title || !filename) {
      return NextResponse.json(
        { error: 'id, surveyId, title, and filename are required' },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();

    // Verify survey ownership
    const surveySnap = await db.collection('surveys').doc(surveyId).get();
    if (surveySnap.exists && surveySnap.data().userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const reportData = {
      surveyId,
      title: title.substring(0, 200),
      filename: filename.substring(0, 200),
      version: version || 1,
      sizeBytes: sizeBytes || 0,
      signatureCount: signatureCount || 0,
      createdBy: userId,
      createdAt: new Date(),
    };

    // Use the client-provided ID so IDB and Firestore share the same key
    await db.collection('surveyReports').doc(id).set(reportData);

    return NextResponse.json(
      {
        success: true,
        data: { id, ...reportData, createdAt: reportData.createdAt.toISOString() },
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Error saving survey report metadata', error);
    return NextResponse.json({ error: 'Failed to save report' }, { status: 500 });
  }
}

// ── DELETE — Remove report metadata ──────────────────────────────
export async function DELETE(request) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) return authResult.error;

    const userId = authResult.userId;
    const { searchParams } = new URL(request.url);
    const reportId = searchParams.get('reportId');

    if (!reportId) {
      return NextResponse.json({ error: 'reportId is required' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const reportRef = db.collection('surveyReports').doc(reportId);
    const reportSnap = await reportRef.get();

    if (!reportSnap.exists) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    if (reportSnap.data().createdBy !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await reportRef.delete();

    return NextResponse.json({ success: true, message: 'Report deleted' });
  } catch (error) {
    logger.error('Error deleting survey report', error);
    return NextResponse.json({ error: 'Failed to delete report' }, { status: 500 });
  }
}
