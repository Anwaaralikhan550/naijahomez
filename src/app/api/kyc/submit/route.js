export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { sanitizeDocumentMetadata } from '@/lib/kyc/kyc-service';
import kycSubmissionRepository from '@/lib/db/kyc-submission-repository.cjs';

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

    // Submission (Postgres) and the user's cached kycStatus (Firestore-shim
    // users doc) are written separately now -- submission is the source of
    // truth and goes first; the user doc is a denormalized cache updated
    // right after, safe to retry if it fails.
    const submission = await kycSubmissionRepository.upsertPendingSubmission({
      userId: authResult.userId,
      userEmail: authResult.user?.email || null,
      documents
    });

    const db = getAdminFirestore();
    const userRef = db.collection('users').doc(authResult.userId);
    await userRef.set({
      uid: authResult.userId,
      email: authResult.user?.email || null,
      kycStatus: 'pending',
      idVerification: submission.documents.id || null,
      cacVerification: submission.documents.cac || null,
      verificationRejectedReason: null,
      latestKycSubmissionId: submission.id,
      updatedAt: new Date()
    }, { merge: true });

    return NextResponse.json({
      success: true,
      kycStatus: 'pending',
      submissionId: submission.id,
      documents: submission.documents
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to submit KYC documents' },
      { status: 500 }
    );
  }
}
