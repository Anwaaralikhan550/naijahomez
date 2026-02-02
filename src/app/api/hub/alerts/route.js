import { NextResponse } from 'next/server';
import { verifyAuth, isAdmin } from '@/lib/auth-middleware';
import {
  createEmergencyAlert,
  getEmergencyAlerts,
  updateDocument
} from '@/lib/hubFirestore';
import {
  withApiSecurity,
  createErrorResponse,
  createSuccessResponse,
  sanitizeInput
} from '@/lib/api-validation-middleware';
import logger from '@/lib/logger';

async function handleGET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const communityId = searchParams.get('communityId');

    if (!communityId) {
      return createErrorResponse('Community ID is required', 400);
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
      
      const alertId = await createEmergencyAlert(sanitizedData);
      
      return createSuccessResponse({ alertId }, 'Emergency alert created successfully');
    }

    if (action === 'deactivate_alert') {
      const { alertId } = sanitizedData;
      
      if (!alertId) {
        return createErrorResponse('Alert ID is required', 400);
      }
      
      await updateDocument('emergencyAlerts', alertId, { 
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