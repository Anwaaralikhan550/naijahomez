export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth, isAdmin } from '@/lib/auth-middleware';
import logger from '@/lib/logger';

const errorResponse = (message, code, status = 500) =>
  NextResponse.json({ success: false, error: message, code }, { status });

const authErrorResponse = async (authError) => {
  const status = authError?.status || 401;
  const payload = await authError?.clone?.().json?.().catch(() => ({}));
  const message = payload?.error || 'Authentication required';
  const code = status === 403 ? 'FORBIDDEN' : status === 503 ? 'AUTH_SERVICE_UNAVAILABLE' : 'UNAUTHORIZED';
  return errorResponse(message, code, status);
};

export async function GET(request) {
  try {
    // SECURITY: Verify admin authentication - MANDATORY
    const adminResult = await isAdmin(request);
    if (!adminResult.success) {
      return authErrorResponse(adminResult.error);
    }

    const db = getAdminFirestore();

    const { searchParams } = new URL(request.url);
    const communityId = searchParams.get('communityId');

    if (!communityId) {
      return errorResponse('Community ID is required', 'COMMUNITY_ID_REQUIRED', 400);
    }

    // Admin view - get all access codes for the community
    const querySnapshot = await db.collection('hubAccessCodes')
      .where('communityId', '==', communityId)
      .orderBy('createdAt', 'desc')
      .get();
    const accessCodes = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      accessCodes.push({
        id: doc.id,
        ...data,
        usesLeft: data.maxUses ? Math.max(0, data.maxUses - (data.usedCount || 0)) : null
      });
    });

    return NextResponse.json({ accessCodes });
  } catch (error) {
    logger.error('Error in access-codes GET', error);
    return errorResponse(error.message || 'Failed to fetch access codes', 'ACCESS_CODES_FETCH_FAILED', 500);
  }
}

export async function POST(request) {
  try {
    // SECURITY: Verify admin authentication - MANDATORY
    const adminResult = await isAdmin(request);
    if (!adminResult.success) {
      return authErrorResponse(adminResult.error);
    }

    const db = getAdminFirestore();
    const userId = adminResult.userId;
    const body = await request.json();
    const { action, ...data } = body;

    if (action === 'create_code') {
      const {
        communityId,
        code,
        description,
        maxUses,
        expiresAt,
        role,
        isActive,
        createdBy,
        createdByName
      } = data;

      if (!communityId || !code || !description || !createdBy) {
        return errorResponse('Required fields missing', 'ACCESS_CODE_FIELDS_REQUIRED', 400);
      }

      // Check if code already exists
      const existingCodes = await db.collection('hubAccessCodes')
        .where('code', '==', code.toUpperCase())
        .get();
      
      if (!existingCodes.empty) {
        return errorResponse('Access code already exists', 'ACCESS_CODE_ALREADY_EXISTS', 400);
      }

      const accessCodeData = {
        communityId,
        code: code.toUpperCase(),
        description: description.trim(),
        maxUses: maxUses || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        role: role || 'member',
        isActive: isActive !== false,
        usedCount: 0,
        createdBy,
        createdByName,
        createdAt: new Date(),
        lastModifiedAt: new Date()
      };

      const docRef = await db.collection('hubAccessCodes').add(accessCodeData);
      return NextResponse.json({ codeId: docRef.id });
    }

    if (action === 'toggle_status') {
      const { codeId, isActive } = data;
      
      if (!codeId || isActive === undefined) {
        return errorResponse('Code ID and status are required', 'ACCESS_CODE_UPDATE_FIELDS_REQUIRED', 400);
      }

      await db.collection('hubAccessCodes').doc(codeId).update({
        isActive,
        lastModifiedAt: new Date()
      });

      return NextResponse.json({ success: true });
    }

    if (action === 'delete_code') {
      const { codeId } = data;
      
      if (!codeId) {
        return errorResponse('Code ID is required', 'ACCESS_CODE_ID_REQUIRED', 400);
      }

      // Soft delete by marking as inactive and deleted
      await db.collection('hubAccessCodes').doc(codeId).update({
        isActive: false,
        isDeleted: true,
        deletedAt: new Date()
      });

      return NextResponse.json({ success: true });
    }

    return errorResponse('Invalid action', 'INVALID_ACTION', 400);
  } catch (error) {
    console.error('Error in access-codes POST:', error);
    return errorResponse(error.message || 'Failed to update access codes', 'ACCESS_CODES_UPDATE_FAILED', 500);
  }
}
