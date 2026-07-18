export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth-middleware';
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
    // SECURITY: Verify admin authentication
    const adminResult = await isAdmin(request);
    if (!adminResult.success) {
      return authFailureResponse(adminResult.error, 'FORBIDDEN');
    }

    const db = getAdminFirestore();

    const { searchParams } = new URL(request.url);
    const communityId = searchParams.get('communityId');

    if (!communityId) {
      return errorResponse('Community ID is required', 'VALIDATION_ERROR', 400);
    }

    // Get all members for the community
    const querySnapshot = await db.collection('hubMembers')
      .where('communityId', '==', communityId)
      .where('isActive', '==', true)
      .orderBy('joinedAt', 'desc')
      .get();
    const members = [];
    querySnapshot.forEach((doc) => {
      members.push({ id: doc.id, ...doc.data() });
    });

    return NextResponse.json({ members });
  } catch (error) {
    logger.error('Error in admin members API', error);
    return errorResponse(error.message, 'INTERNAL_ERROR', 500);
  }
}

export async function POST(request) {
  try {
    // SECURITY: Verify admin authentication - MANDATORY
    const adminResult = await isAdmin(request);
    if (!adminResult.success) {
      return authFailureResponse(adminResult.error, 'FORBIDDEN');
    }

    const db = getAdminFirestore();
    const requestingUserId = adminResult.userId;
    const body = await request.json();
    const { action, memberId, ...data } = body;

    const getTargetUserId = async () => {
      const memberDoc = await db.collection('hubMembers').doc(memberId).get();
      if (!memberDoc.exists) {
        return { error: errorResponse('Member not found', 'NOT_FOUND', 404) };
      }
      return { userId: memberDoc.data()?.userId || null };
    };

    if (action === 'update_role') {
      const { role } = data;
      
      if (!memberId || !role) {
        return errorResponse('Member ID and role are required', 'VALIDATION_ERROR', 400);
      }

      // Validate role
      const validRoles = ['member', 'moderator', 'admin'];
      if (!validRoles.includes(role)) {
        return errorResponse('Invalid role', 'VALIDATION_ERROR', 400);
      }

      const target = await getTargetUserId();
      if (target.error) return target.error;
      if (target.userId === requestingUserId) {
        return errorResponse('Admins cannot modify their own role', 'VALIDATION_ERROR', 400);
      }

      await db.collection('hubMembers').doc(memberId).update({
        role,
        lastModifiedBy: requestingUserId,
        lastModifiedAt: new Date()
      });

      return NextResponse.json({ success: true });
    }

    if (action === 'remove_member') {
      if (!memberId) {
        return errorResponse('Member ID is required', 'VALIDATION_ERROR', 400);
      }

      const target = await getTargetUserId();
      if (target.error) return target.error;
      if (target.userId === requestingUserId) {
        return errorResponse('Admins cannot remove themselves', 'VALIDATION_ERROR', 400);
      }

      // Soft delete - mark as inactive instead of deleting
      await db.collection('hubMembers').doc(memberId).update({
        isActive: false,
        removedBy: requestingUserId,
        removedAt: new Date()
      });

      return NextResponse.json({ success: true });
    }

    if (action === 'update_member') {
      const { unitNumber, phoneNumber, notes } = data;
      
      if (!memberId) {
        return errorResponse('Member ID is required', 'VALIDATION_ERROR', 400);
      }

      const updateData = {
        lastModifiedBy: requestingUserId,
        lastModifiedAt: new Date()
      };

      if (unitNumber !== undefined) updateData.unitNumber = unitNumber;
      if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
      if (notes !== undefined) updateData.adminNotes = notes;

      await db.collection('hubMembers').doc(memberId).update(updateData);

      return NextResponse.json({ success: true });
    }

    return errorResponse('Invalid action', 'VALIDATION_ERROR', 400);
  } catch (error) {
    console.error('Error in admin members POST:', error);
    return errorResponse(error.message, 'INTERNAL_ERROR', 500);
  }
}
