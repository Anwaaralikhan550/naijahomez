export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import { getAdminFirestore } from '@/lib/firebase-admin';
import {
  getLatestKycSubmission,
  nowDate,
  sanitizeDocumentMetadata
} from '@/lib/kyc/kyc-service';

function buildDocumentsFromBody(body = {}) {
  const documents = {};
  if (body.idVerification) {
    documents.id = sanitizeDocumentMetadata(body.idVerification, 'id');
  }
  if (body.cacVerification) {
    documents.cac = sanitizeDocumentMetadata(body.cacVerification, 'cac');
  }
  return documents;
}

export async function POST(request) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) return authResult.error;

    const body = await request.json().catch(() => ({}));
    const documents = buildDocumentsFromBody(body);
    if (!documents.id && !documents.cac) {
      return NextResponse.json(
        { success: false, error: 'Upload at least one KYC document before submitting.' },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    const userRef = db.collection('users').doc(authResult.userId);
    const latest = await getLatestKycSubmission(db, authResult.userId);
    const now = nowDate();

    const previousDocuments =
      latest && ['pending', 'rejected', 'unverified'].includes(String(latest.data.status || '').toLowerCase())
        ? latest.data.documents || {}
        : {};

    const submissionRef =
      latest && ['pending', 'rejected', 'unverified'].includes(String(latest.data.status || '').toLowerCase())
        ? latest.ref
        : db.collection('kycSubmissions').doc();

    const mergedDocuments = {
      ...previousDocuments,
      ...documents
    };

    await db.runTransaction(async (transaction) => {
      transaction.set(submissionRef, {
        userId: authResult.userId,
        userEmail: authResult.user?.email || null,
        status: 'pending',
        documents: mergedDocuments,
        submittedAt: now,
        rejectionReason: null,
        reviewedAt: null,
        reviewedBy: null,
        createdAt: latest?.data?.createdAt || now,
        updatedAt: now
      }, { merge: true });

      transaction.set(userRef, {
        uid: authResult.userId,
        email: authResult.user?.email || null,
        kycStatus: 'pending',
        idVerification: mergedDocuments.id || null,
        cacVerification: mergedDocuments.cac || null,
        verificationRejectedReason: null,
        latestKycSubmissionId: submissionRef.id,
        updatedAt: now
      }, { merge: true });
    });

    return NextResponse.json({
      success: true,
      kycStatus: 'pending',
      submissionId: submissionRef.id,
      documents: mergedDocuments
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to submit KYC documents' },
      { status: 500 }
    );
  }
}
