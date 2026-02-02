import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import { withValidation } from '@/lib/api-validation-middleware';
import logger from '@/lib/logger';

async function handleAuthPost(request) {
  try {
    // Initialize admin SDK
    const db = getAdminFirestore();

    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const userId = authResult.userId;
    const body = request.parsedBody || await request.json();
    const { action, accessCode } = body;

    if (action === 'validate_access_code') {
      if (!accessCode) {
        return NextResponse.json({ error: 'Access code is required' }, { status: 400 });
      }

      // Check if the access code exists and is valid
      const querySnapshot = await db.collection('hubAccessCodes')
        .where('code', '==', accessCode.toUpperCase())
        .where('isActive', '==', true)
        .get();
      
      if (querySnapshot.empty) {
        return NextResponse.json({ 
          valid: false, 
          error: 'Invalid or expired access code' 
        }, { status: 400 });
      }

      const accessCodeDoc = querySnapshot.docs[0];
      const accessCodeData = accessCodeDoc.data();

      // Check if code has expiration date and if it's expired
      if (accessCodeData.expiresAt && accessCodeData.expiresAt.toDate() < new Date()) {
        return NextResponse.json({ 
          valid: false, 
          error: 'Access code has expired' 
        }, { status: 400 });
      }

      // Check usage limits
      if (accessCodeData.maxUses && accessCodeData.usedCount >= accessCodeData.maxUses) {
        return NextResponse.json({ 
          valid: false, 
          error: 'Access code usage limit reached' 
        }, { status: 400 });
      }

      return NextResponse.json({ 
        valid: true,
        communityId: accessCodeData.communityId,
        role: accessCodeData.role || 'member',
        codeId: accessCodeDoc.id
      });
    }

    if (action === 'use_access_code') {
      if (!userId || !body.codeId) {
        return NextResponse.json({ error: 'User ID and code ID are required' }, { status: 400 });
      }

      // Update access code usage
      await db.collection('hubAccessCodes').doc(body.codeId).update({
        usedCount: (body.currentUsedCount || 0) + 1,
        lastUsedAt: new Date(),
        lastUsedBy: userId
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    logger.error('Error in auth API', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Export with rate limiting for auth endpoints (10 requests/minute)
export const POST = withValidation(handleAuthPost, {
  rateLimitType: 'auth',
  validateBody: true
});