export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth-middleware';
import { backfillListingsKycStatus, getLatestKycSubmission } from '@/lib/kyc/kyc-service';

const ALLOWED_ACTIONS = ['approve', 'reject'];

const toIsoString = (value) => {
  try {
    if (!value) return null;
    if (typeof value?.toDate === 'function') return value.toDate().toISOString();
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  } catch (error) {
    return null;
  }
};

const mapUserForKycApproval = (doc, submissionDoc = null) => {
  const data = doc.data() || {};
  const submissionData = submissionDoc?.data?.() || submissionDoc?.data || {};
  const documents = submissionData.documents || {};

  return {
    uid: data.uid || doc.id,
    id: doc.id,
    submissionId: submissionDoc?.id || data.latestKycSubmissionId || null,
    displayName: data.displayName || data.name || null,
    email: data.email || null,
    phoneNumber: data.phoneNumber || data.phone || null,
    phoneVerification: data.phoneVerification || submissionData.phoneVerification || null,
    kycStatus: data.kycStatus || null,
    idVerification: data.idVerification || documents.id || null,
    cacVerification: data.cacVerification || documents.cac || null,
    rejectionReason: data.verificationRejectedReason || submissionData.rejectionReason || null,
    submittedAt: toIsoString(submissionData.submittedAt),
    reviewedAt: toIsoString(submissionData.reviewedAt),
    reviewedBy: submissionData.reviewedBy || null,
    updatedAt: toIsoString(data.updatedAt),
    createdAt: toIsoString(data.createdAt)
  };
};

export async function GET(request) {
  try {
    const adminResult = await isAdmin(request);
    if (!adminResult.success) {
      return adminResult.error;
    }

    const db = getAdminFirestore();
    const submissionSnapshot = await db
      .collection('kycSubmissions')
      .where('status', '==', 'pending')
      .get();

    const users = await Promise.all(submissionSnapshot.docs.map(async (submissionDoc) => {
      const data = submissionDoc.data() || {};
      const userDoc = await db.collection('users').doc(data.userId).get();
      if (!userDoc.exists) return null;
      return mapUserForKycApproval(userDoc, submissionDoc);
    }));

    const filteredUsers = users
      .filter(Boolean)
      .sort((a, b) => {
        const aTime = Date.parse(a.submittedAt || a.updatedAt || a.createdAt || '') || 0;
        const bTime = Date.parse(b.submittedAt || b.updatedAt || b.createdAt || '') || 0;
        return bTime - aTime;
      });

    return NextResponse.json({
      success: true,
      users: filteredUsers
    });
  } catch (error) {
    console.error('Error fetching pending KYC approvals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending KYC approvals' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const adminResult = await isAdmin(request);
    if (!adminResult.success) {
      return adminResult.error;
    }

    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
    const submissionId = typeof body?.submissionId === 'string' ? body.submissionId.trim() : '';
    const action = typeof body?.action === 'string' ? body.action.trim().toLowerCase() : '';
    const rejectionReason = typeof body?.rejectionReason === 'string' ? body.rejectionReason.trim() : '';

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    if (!ALLOWED_ACTIONS.includes(action)) {
      return NextResponse.json(
        { error: "action must be one of ['approve', 'reject']" },
        { status: 400 }
      );
    }

    if (action === 'reject' && rejectionReason.length < 5) {
      return NextResponse.json(
        { error: 'A rejection reason of at least 5 characters is required' },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const nextStatus = action === 'approve' ? 'verified' : 'rejected';
    const now = new Date();
    const latestSubmission = submissionId
      ? { ref: db.collection('kycSubmissions').doc(submissionId) }
      : await getLatestKycSubmission(db, userId);

    await db.runTransaction(async (transaction) => {
      transaction.update(userRef, {
        kycStatus: nextStatus,
        verificationStatus: nextStatus,
        verifiedAt: action === 'approve' ? now : null,
        verifiedBy: action === 'approve' ? adminResult.userId : null,
        verificationRejectedReason: action === 'reject' ? rejectionReason : null,
        updatedAt: now
      });

      if (latestSubmission?.ref) {
        transaction.set(latestSubmission.ref, {
          status: nextStatus,
          reviewedAt: now,
          reviewedBy: adminResult.userId,
          rejectionReason: action === 'reject' ? rejectionReason : null,
          updatedAt: now
        }, { merge: true });
      }
    });

    const syncedListings = await backfillListingsKycStatus({
      db,
      userId,
      kycStatus: nextStatus
    });

    return NextResponse.json({
      success: true,
      userId,
      kycStatus: nextStatus,
      syncedListings,
      updatedAt: now.toISOString()
    });
  } catch (error) {
    console.error('Error updating KYC approval status:', error);
    return NextResponse.json(
      { error: 'Failed to update KYC approval status' },
      { status: 500 }
    );
  }
}
