export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyAuth } from '@/lib/auth-middleware';
import { withValidation } from '@/lib/api-validation-middleware';
import logger from '@/lib/logger';

const errorResponse = (message, code, status = 500) =>
  NextResponse.json({ success: false, error: message, code }, { status });

async function handleAuthPost(request) {
  try {
    // Initialize admin SDK
    const db = getAdminFirestore();
    const body = request.parsedBody || await request.json();
    const { action, accessCode } = body;

    if (action === 'validate_access_code') {
      if (!accessCode) {
        return errorResponse('Access code is required', 'ACCESS_CODE_REQUIRED', 400);
      }

      // Check if the access code exists and is valid
      const querySnapshot = await db.collection('hubAccessCodes')
        .where('code', '==', accessCode.toUpperCase())
        .where('isActive', '==', true)
        .get();
      
      if (querySnapshot.empty) {
        return errorResponse('Invalid or expired access code', 'ACCESS_CODE_INVALID', 400);
      }

      const accessCodeDoc = querySnapshot.docs[0];
      const accessCodeData = accessCodeDoc.data();

      // Check if code has expiration date and if it's expired
      if (accessCodeData.expiresAt && accessCodeData.expiresAt.toDate() < new Date()) {
        return errorResponse('Access code has expired', 'ACCESS_CODE_EXPIRED', 400);
      }

      // Check usage limits
      if (accessCodeData.maxUses && accessCodeData.usedCount >= accessCodeData.maxUses) {
        return errorResponse('Access code usage limit reached', 'ACCESS_CODE_LIMIT_REACHED', 400);
      }

      return NextResponse.json({ 
        valid: true,
        communityId: accessCodeData.communityId,
        role: accessCodeData.role || 'member',
        codeId: accessCodeDoc.id
      });
    }

    if (action === 'use_access_code') {
      if (!body.codeId) {
        return errorResponse('Code ID is required', 'ACCESS_CODE_USAGE_FIELDS_REQUIRED', 400);
      }

      // Authenticated user preferred, fallback to explicit access-code identity for guest flow.
      let actorUserId = null;
      const authResult = await verifyAuth(request);
      if (authResult.success) {
        actorUserId = authResult.userId;
      } else if (typeof body.userId === 'string' && body.userId.trim()) {
        actorUserId = body.userId.trim();
      }

      // Update access code usage
      await db.collection('hubAccessCodes').doc(body.codeId).update({
        usedCount: FieldValue.increment(1),
        lastUsedAt: new Date(),
        lastUsedBy: actorUserId
      });

      return NextResponse.json({ success: true });
    }

    return errorResponse('Invalid action', 'INVALID_ACTION', 400);
  } catch (error) {
    logger.error('Error in auth API', error);
    return errorResponse(error.message || 'Authentication operation failed', 'AUTH_OPERATION_FAILED', 500);
  }
}

// Export with rate limiting for auth endpoints (10 requests/minute)
export const POST = withValidation(handleAuthPost, {
  rateLimitType: 'auth',
  validateBody: true
});
