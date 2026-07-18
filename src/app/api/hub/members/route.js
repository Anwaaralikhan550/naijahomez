export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth, isAdmin } from '@/lib/auth-middleware';
import { withApiSecurity, validateMemberRequest, createErrorResponse, createSuccessResponse } from '@/lib/api-validation-middleware';
import logger from '@/lib/logger';

const FIRESTORE_INDEX_URL_REGEX = /(https:\/\/console\.firebase\.google\.com\/[^\s)\]]+)/i;

function errorResponse(message, code = 'INTERNAL_ERROR', status = 500) {
  return NextResponse.json({ success: false, error: message, code }, { status });
}

function extractFirestoreIndexUrl(error) {
  const message = String(error?.message || '');
  const match = message.match(FIRESTORE_INDEX_URL_REGEX);
  return match?.[1] || null;
}

function isFirestoreMissingIndexError(error) {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();
  return (
    code === 'FAILED_PRECONDITION' ||
    code === '9' ||
    message.includes('failed precondition') ||
    (message.includes('index') && message.includes('create'))
  );
}

async function runFirestoreRead(readOperation, context) {
  try {
    return await readOperation();
  } catch (error) {
    if (isFirestoreMissingIndexError(error)) {
      const indexUrl = extractFirestoreIndexUrl(error);
      if (indexUrl) {
        logger.error(`[Firestore Index Required][${context}] ${indexUrl}`);
      }

      const wrappedError = new Error('Firestore index required');
      wrappedError.code = 'FIRESTORE_INDEX_REQUIRED';
      wrappedError.status = 503;
      wrappedError.indexUrl = indexUrl;
      wrappedError.context = context;
      throw wrappedError;
    }

    throw error;
  }
}

function firestoreErrorResponse(error, fallbackMessage = 'Internal server error', fallbackCode = 'INTERNAL_ERROR') {
  if (error?.code === 'FIRESTORE_INDEX_REQUIRED') {
    return NextResponse.json(
      {
        success: false,
        error: 'Firestore index required for this query',
        code: 'FIRESTORE_INDEX_REQUIRED',
        indexUrl: error?.indexUrl || null
      },
      { status: error?.status || 503 }
    );
  }

  return errorResponse(fallbackMessage, fallbackCode, 500);
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



const handleGET = async (request) => {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authFailureResponse(authResult.error);
    }

    // Initialize admin SDK
    const db = getAdminFirestore();

    const { searchParams } = new URL(request.url);
    const communityId = searchParams.get('communityId');
    const role = searchParams.get('role');
    const building = searchParams.get('building');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!communityId) {
      return errorResponse('Community ID is required');
    }

    // Validate limit and offset
    if (limit > 100) {
      return errorResponse('Limit cannot exceed 100');
    }

    let query = db.collection('hubMembers')
      .where('communityId', '==', communityId)
      .where('isActive', '==', true)
      .orderBy('joinedAt', 'desc');

    // Additional filters
    if (role) {
      query = query.where('role', '==', role);
    }

    if (building) {
      query = query.where('building', '==', building);
    }

    const querySnapshot = await runFirestoreRead(() => query.get(), 'hubMembers.listMembers');
    const members = [];
    
    querySnapshot.forEach((doc) => {
      const memberData = { id: doc.id, ...doc.data() };
      
      // Don't expose sensitive information to regular members
      const publicMemberData = {
        id: memberData.id,
        userId: memberData.userId,
        userName: memberData.userName,
        userEmail: memberData.userEmail,
        role: memberData.role,
        apartment: memberData.apartment,
        building: memberData.building,
        joinedAt: memberData.joinedAt,
        isFounder: memberData.isFounder,
        lastActive: memberData.lastActive,
        phone: memberData.phone // Only if they've made it public
      };
      
      members.push(publicMemberData);
    });

    return NextResponse.json({ members });
  } catch (error) {
    logger.error('Error in hub members GET', error);
    return firestoreErrorResponse(error, error?.message || 'Failed to fetch members', 'MEMBERS_FETCH_FAILED');
  }
}

const handlePOST = async (request) => {
  try {
    // Initialize admin SDK
    const db = getAdminFirestore();

    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authFailureResponse(authResult.error);
    }

    const userId = authResult.userId;
    const body = await request.json();
    const { action, ...data } = body;

    if (action === 'update_member_info') {
      const { memberId, phone, apartment, building, isPublicContact } = data;

      if (!memberId) {
        return errorResponse('Member ID is required');
      }

      // SECURITY: Verify ownership before updating
      const memberSnap = await runFirestoreRead(
        () => db.collection('hubMembers').doc(memberId).get(),
        'hubMembers.getMemberForUpdate'
      );
      if (!memberSnap.exists()) {
        return errorResponse('Member not found', 404);
      }

      const memberData = memberSnap.data();
      if (memberData.userId !== userId) {
        return errorResponse('You can only update your own member info', 403);
      }

      // Validate phone if provided
      if (phone && phone.trim()) {
        const { isValidPhone } = require('@/utils/validation');
        if (!isValidPhone(phone)) {
          return errorResponse('Please enter a valid phone number');
        }
      }

      // Validate apartment if provided
      if (apartment && (apartment.length < 1 || apartment.length > 20)) {
        return errorResponse('Unit number must be 1-20 characters');
      }

      const updateData = {};

      if (phone !== undefined) updateData.phone = phone?.trim();
      if (apartment !== undefined) updateData.apartment = apartment?.trim();
      if (building !== undefined) updateData.building = building?.trim();
      if (isPublicContact !== undefined) updateData.isPublicContact = !!isPublicContact;

      updateData.updatedAt = new Date();

      await db.collection('hubMembers').doc(memberId).update(updateData);
      return createSuccessResponse({ updated: true });
    }

    if (action === 'update_privacy_settings') {
      const { memberId, privacySettings } = data;

      if (!memberId) {
        return errorResponse('Member ID is required', 'VALIDATION_ERROR', 400);
      }

      // SECURITY: Verify ownership before updating privacy settings
      const memberSnap = await runFirestoreRead(
        () => db.collection('hubMembers').doc(memberId).get(),
        'hubMembers.getMemberPrivacy'
      );
      if (!memberSnap.exists()) {
        return errorResponse('Member not found', 'NOT_FOUND', 404);
      }

      const memberData = memberSnap.data();
      if (memberData.userId !== userId) {
        return errorResponse('You can only update your own privacy settings', 'FORBIDDEN', 403);
      }

      await db.collection('hubMembers').doc(memberId).update({
        privacySettings: privacySettings || {
          showPhone: false,
          showEmail: true,
          showApartment: true,
          allowMessages: true
        },
        updatedAt: new Date()
      });

      return NextResponse.json({ success: true });
    }

    if (action === 'get_member_profile') {
      const { memberId } = data;
      
      if (!memberId) {
        return errorResponse('Member ID is required', 'VALIDATION_ERROR', 400);
      }

      const memberSnap = await runFirestoreRead(
        () => db.collection('hubMembers').doc(memberId).get(),
        'hubMembers.getMemberProfile'
      );
      
      if (!memberSnap.exists()) {
        return errorResponse('Member not found', 'NOT_FOUND', 404);
      }

      const memberData = { id: memberSnap.id, ...memberSnap.data() };
      return NextResponse.json({ member: memberData });
    }

    return errorResponse('Invalid action');
  } catch (error) {
    logger.error('Error in hub members POST', error);
    return firestoreErrorResponse(error, 'Internal server error', 'INTERNAL_ERROR');
  }
};


// Export secured handlers
export const GET = withApiSecurity(handleGET, {
  requiredFields: [],
  validateBody: false,
  rateLimitType: 'global'
});

export const POST = withApiSecurity(handlePOST, {
  requiredFields: ['action'],
  validateBody: true,
  rateLimitType: 'global'
});
