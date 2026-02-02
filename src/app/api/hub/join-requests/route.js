import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import logger from '@/lib/logger';

export async function GET(request) {
  try {
    // SECURITY: Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const authenticatedUserId = authResult.userId;
    const db = getAdminFirestore();

    const { searchParams } = new URL(request.url);
    const communityId = searchParams.get('communityId');
    const requestedUserId = searchParams.get('userId');
    const status = searchParams.get('status') || 'all';

    if (!communityId && !requestedUserId) {
      return NextResponse.json(
        { error: 'Either communityId or userId is required' },
        { status: 400 }
      );
    }

    let query;
    if (requestedUserId) {
      // SECURITY: Users can only view their own requests
      if (requestedUserId !== authenticatedUserId) {
        return NextResponse.json(
          { error: 'You can only view your own join requests' },
          { status: 403 }
        );
      }
      query = db
        .collection('joinRequests')
        .where('userId', '==', requestedUserId)
        .orderBy('createdAt', 'desc');
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
        return NextResponse.json(
          { error: 'Only admins can view community join requests' },
          { status: 403 }
        );
      }

      if (status === 'all') {
        query = db
          .collection('joinRequests')
          .where('communityId', '==', communityId)
          .orderBy('createdAt', 'desc');
      } else {
        query = db
          .collection('joinRequests')
          .where('communityId', '==', communityId)
          .where('status', '==', status)
          .orderBy('createdAt', 'desc');
      }
    }

    const querySnapshot = await query.get();
    const requests = [];
    querySnapshot.forEach((doc) => {
      requests.push({ id: doc.id, ...doc.data() });
    });

    return NextResponse.json({ requests });
  } catch (error) {
    logger.error('Error in join requests API', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    // Initialize admin SDK
    const db = getAdminFirestore();

    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const userId = authResult.userId;
    const body = await request.json();
    const { action, ...data } = body;

    if (action === 'approve' || action === 'reject') {
      const { requestId, adminId, adminNotes } = data;

      if (!requestId) {
        return NextResponse.json(
          { error: 'Request ID is required' },
          { status: 400 }
        );
      }

      await db
        .collection('joinRequests')
        .doc(requestId)
        .update({
          status: action === 'approve' ? 'approved' : 'rejected',
          reviewedBy: adminId,
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
          approvedBy: adminId,
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
