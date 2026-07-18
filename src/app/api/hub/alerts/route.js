export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import { getAdminFirestore } from '@/lib/firebase-admin';
import {
  createEmergencyAlert,
  getEmergencyAlerts,
  updateDocument,
  isUserActiveCommunityMember
} from '@/lib/hubFirestore';
import {
  withApiSecurity,
  createErrorResponse,
  createSuccessResponse,
  sanitizeInput
} from '@/lib/api-validation-middleware';
import logger from '@/lib/logger';

async function isAdminOrModerator(userId, communityId) {
  const db = getAdminFirestore();
  const roleSnapshot = await db.collection('hubMembers')
    .where('userId', '==', userId)
    .where('communityId', '==', communityId)
    .where('role', 'in', ['admin', 'moderator'])
    .limit(1)
    .get();

  return !roleSnapshot.empty;
}

async function handleGET(request) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const userId = authResult.userId;
    const { searchParams } = new URL(request.url);
    const communityId = searchParams.get('communityId');

    if (!communityId) {
      return createErrorResponse('Community ID is required', 400);
    }

    const isMember = await isUserActiveCommunityMember(userId, communityId);
    if (!isMember) {
      return createErrorResponse('Active community membership required', 403);
    }

    const alerts = await getEmergencyAlerts(communityId);
    return createSuccessResponse({ alerts });
  } catch (error) {
    logger.error('Error in alerts API', error);
    return createErrorResponse(error.message, 500);
  }
}

async function handlePOST(request) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const userId = authResult.userId;
    const body = request.parsedBody;
    const { action, ...data } = body;

    // Sanitize input data
    const sanitizedData = sanitizeInput(data);

    if (action === 'create_alert') {
      if (!sanitizedData.communityId || !sanitizedData.title || !sanitizedData.message) {
        return createErrorResponse('Community ID, title, and message are required', 400);
      }

      const canManageAlerts = await isAdminOrModerator(userId, sanitizedData.communityId);
      if (!canManageAlerts) {
        return createErrorResponse('Admin or moderator access required', 403);
      }
      
      const alertId = await createEmergencyAlert(sanitizedData);
      
      return createSuccessResponse({ alertId }, 'Emergency alert created successfully');
    }

    if (action === 'deactivate_alert') {
      const { alertId, communityId } = sanitizedData;
      
      if (!alertId || !communityId) {
        return createErrorResponse('Alert ID and community ID are required', 400);
      }

      const canManageAlerts = await isAdminOrModerator(userId, communityId);
      if (!canManageAlerts) {
        return createErrorResponse('Admin or moderator access required', 403);
      }
      
      await updateDocument('hubEmergencyAlerts', alertId, {
        isActive: false,
        deactivatedAt: new Date() 
      });
      return createSuccessResponse({}, 'Alert deactivated successfully');
    }

    return createErrorResponse('Invalid action', 400);
  } catch (error) {
    logger.error('Error in alerts POST', error);
    return createErrorResponse(error.message, 500);
  }
}

// Apply security middleware with global rate limiting
export const GET = withApiSecurity(handleGET, {
  rateLimitType: 'global'
});

export const POST = withApiSecurity(handlePOST, {
  rateLimitType: 'global',
  requiredFields: ['action'],
  validateBody: true
});
