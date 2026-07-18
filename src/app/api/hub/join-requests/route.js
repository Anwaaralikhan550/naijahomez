export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import logger from '@/lib/logger';

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



export async function GET(request) {
  try {
    // SECURITY: Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authFailureResponse(authResult.error);
    }

    const authenticatedUserId = authResult.userId;
    const db = getAdminFirestore();

    const { searchParams } = new URL(request.url);
    const communityId = searchParams.get('communityId');
    const requestedUserId = searchParams.get('userId');
    const status = searchParams.get('status') || 'all';

    if (!communityId && !requestedUserId) {
      return errorResponse('Either communityId or userId is required', 'VALIDATION_ERROR', 400);
    }

    let query;
    if (requestedUserId) {
      // SECURITY: Users can only view their own requests
      if (requestedUserId !== authenticatedUserId) {
        return errorResponse('You can only view your own join requests', 'FORBIDDEN', 403);
      }
      query = db
        .collection('joinRequests')
        .where('userId', '==', requestedUserId);
    } else {
      // SECURITY: Verify user is admin/moderator of the community to view all requests
      const memberQuery = await db.collection('hubMembers')
        .where('userId', '==', authenticatedUserId)
        .where('communityId', '==', communityId)
        .where('isActive', '==', true)
        .where('role', 'in', ['admin', 'moderator'])
        .limit(1)
        .get();

      if (memberQuery.empty) {
        return errorResponse('Only admins can view community join requests', 'FORBIDDEN', 403);
      }

      query = db
        .collection('joinRequests')
        .where('communityId', '==', communityId);
      if (status !== 'all') {
        query = query.where('status', '==', status);
      }
    }

    const querySnapshot = await query.get();
    const requests = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // Convert Firestore timestamps to serializable format
      if (data.createdAt && typeof data.createdAt.toDate === 'function') {
        data.createdAt = data.createdAt.toDate().toISOString();
      }
      if (data.updatedAt && typeof data.updatedAt.toDate === 'function') {
        data.updatedAt = data.updatedAt.toDate().toISOString();
      }
      requests.push({ id: doc.id, ...data });
    });

    // Sort by createdAt descending (client-side to avoid composite index requirement)
    requests.sort((a, b) => {
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      return bTime - aTime;
    });

    return NextResponse.json({ requests });
  } catch (error) {
    logger.error('Error in join requests API', error);
    return errorResponse(error.message, 'INTERNAL_ERROR', 500);
  }
}

export async function POST(request) {
  try {
    // Initialize admin SDK
    const db = getAdminFirestore();

    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authFailureResponse(authResult.error);
    }

    const authenticatedUserId = authResult.userId;
    const body = await request.json();
    const { action, ...data } = body;

    if (action === 'approve' || action === 'reject') {
      const { requestId, adminNotes } = data;

      if (!requestId) {
        return errorResponse('Request ID is required', 'VALIDATION_ERROR', 400);
      }

      await db
        .collection('joinRequests')
        .doc(requestId)
        .update({
          status: action === 'approve' ? 'approved' : 'rejected',
          reviewedBy: authenticatedUserId,
          reviewedAt: new Date(),
          adminNotes: adminNotes || '',
        });

      // If approved, create hub member record
      if (action === 'approve') {
        const { createHubMember } = await import('@/lib/hubFirestore');
        await createHubMember({
          userId: data.userId,
          communityId: data.communityId,
          role: 'member',
          unitNumber: data.unitNumber,
          phoneNumber: data.phoneNumber,
          approvedBy: authenticatedUserId,
          approvedAt: new Date(),
        });
      }

      return NextResponse.json({ success: true });
    }

    // Create new join request
    const {
      userId: requestUserId,
      userName,
      userEmail,
      communityId,
      communityName,
      message,
      phoneNumber,
      unitNumber,
    } = body;

    if (!requestUserId || !communityId) {
      return NextResponse.json(
        {
          error: 'User ID and Community ID are required',
        },
        { status: 400 }
      );
    }

    if (requestUserId !== authenticatedUserId) {
      return errorResponse('You can only create requests for your own account', 'FORBIDDEN', 403);
    }

    // Check if user already has a pending request for this community
    const existingRequests = await db
      .collection('joinRequests')
      .where('userId', '==', requestUserId)
      .where('communityId', '==', communityId)
      .where('status', '==', 'pending')
      .get();
    if (!existingRequests.empty) {
      return NextResponse.json(
        {
          error: 'You already have a pending request for this community',
        },
        { status: 400 }
      );
    }

    const docRef = await db.collection('joinRequests').add({
      userId: requestUserId,
      userName,
      userEmail,
      communityId,
      communityName,
      message,
      phoneNumber,
      unitNumber,
      status: 'pending',
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      requestId: docRef.id,
    });
  } catch (error) {
    console.error('Error in join requests POST:', error);
    return errorResponse(error.message, 'INTERNAL_ERROR', 500);
  }
}
