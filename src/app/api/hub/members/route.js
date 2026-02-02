import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth, isAdmin } from '@/lib/auth-middleware';
import { withApiSecurity, validateMemberRequest, createErrorResponse, createSuccessResponse } from '@/lib/api-validation-middleware';
import logger from '@/lib/logger';

const handleGET = async (request) => {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
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
      return createErrorResponse('Community ID is required');
    }

    // Validate limit and offset
    if (limit > 100) {
      return createErrorResponse('Limit cannot exceed 100');
    }

    let query = db.collection('hubMembers')
      .where('communityId', '==', communityId)
      .where('isActive', '==', true)
      .orderBy('joinedAt', 'desc');

    // Additional filters
    if (role) {
      query = db.collection('hubMembers')
        .where('communityId', '==', communityId)
        .where('isActive', '==', true)
        .where('role', '==', role)
        .orderBy('joinedAt', 'desc');
    }

    const querySnapshot = await query.get();
    const members = [];
    
    querySnapshot.forEach((doc) => {
      const memberData = { id: doc.id, ...doc.data() };
      
      // Filter by building if specified
      if (building && memberData.building !== building) {
        return;
      }
      
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

const handlePOST = async (request) => {
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

    if (action === 'update_member_info') {
      const { memberId, phone, apartment, building, isPublicContact } = data;

      if (!memberId) {
        return createErrorResponse('Member ID is required');
      }

      // SECURITY: Verify ownership before updating
      const memberSnap = await db.collection('hubMembers').doc(memberId).get();
      if (!memberSnap.exists()) {
        return createErrorResponse('Member not found', 404);
      }

      const memberData = memberSnap.data();
      if (memberData.userId !== userId) {
        return createErrorResponse('You can only update your own member info', 403);
      }

      // Validate phone if provided
      if (phone && phone.trim()) {
        const { isValidPhone } = require('@/utils/validation');
        if (!isValidPhone(phone)) {
          return createErrorResponse('Please enter a valid phone number');
        }
      }

      // Validate apartment if provided
      if (apartment && (apartment.length < 1 || apartment.length > 20)) {
        return createErrorResponse('Unit number must be 1-20 characters');
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
        return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
      }

      // SECURITY: Verify ownership before updating privacy settings
      const memberSnap = await db.collection('hubMembers').doc(memberId).get();
      if (!memberSnap.exists()) {
        return NextResponse.json({ error: 'Member not found' }, { status: 404 });
      }

      const memberData = memberSnap.data();
      if (memberData.userId !== userId) {
        return NextResponse.json({ error: 'You can only update your own privacy settings' }, { status: 403 });
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
        return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
      }

      const memberSnap = await db.collection('hubMembers').doc(memberId).get();
      
      if (!memberSnap.exists()) {
        return NextResponse.json({ error: 'Member not found' }, { status: 404 });
      }

      const memberData = { id: memberSnap.id, ...memberSnap.data() };
      return NextResponse.json({ member: memberData });
    }

    return createErrorResponse('Invalid action');
  } catch (error) {
    logger.error('Error in hub members POST', error);
    return createErrorResponse('Internal server error', 500);
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