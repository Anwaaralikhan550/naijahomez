import { NextResponse } from 'next/server';
import { verifyAuth, isAdmin } from '@/lib/auth-middleware';
import { 
  createNotification,
  getNotifications,
  updateDocument,
  markAllNotificationsRead
} from '@/lib/hubFirestore';
import { 
  withApiSecurity, 
  createErrorResponse, 
  createSuccessResponse,
  sanitizeInput 
} from '@/lib/api-validation-middleware';

async function handleGET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const communityId = searchParams.get('communityId');
    const userId = searchParams.get('userId');
    const adminView = searchParams.get('admin') === 'true';

    if (!communityId) {
      return createErrorResponse('Community ID is required', 400);
    }

    // If admin view, get all notifications for community
    // If user view, get only notifications for that user
    const notifications = await getNotifications(communityId, adminView ? null : userId);
    
    return createSuccessResponse({ notifications });
  } catch (error) {
    console.error('Error in notifications API:', error);
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

    if (action === 'send_notification') {
      if (!sanitizedData.communityId || !sanitizedData.message) {
        return createErrorResponse('Community ID and message are required', 400);
      }
      
      const notificationId = await createNotification(sanitizedData);
      return createSuccessResponse({ notificationId }, 'Notification sent successfully');
    }

    if (action === 'mark_read') {
      const { notificationId } = sanitizedData;
      if (!notificationId) {
        return createErrorResponse('Notification ID is required', 400);
      }
      
      await updateDocument('hubNotifications', notificationId, { 
        isRead: true,
        readAt: new Date() 
      });
      return createSuccessResponse({}, 'Notification marked as read');
    }

    if (action === 'mark_all_read') {
      const { userId: targetUserId, communityId } = sanitizedData;
      
      if (!targetUserId || !communityId) {
        return createErrorResponse('User ID and Community ID are required', 400);
      }
      
      // Only allow users to mark their own notifications as read, or admins to mark any
      if (targetUserId !== userId) {
        const isUserAdmin = await isAdmin(userId);
        if (!isUserAdmin) {
          return createErrorResponse('Unauthorized', 403);
        }
      }
      
      // Batch update all unread notifications for user in community
      await markAllNotificationsRead(targetUserId, communityId);
      return createSuccessResponse({}, 'All notifications marked as read');
    }

    return createErrorResponse('Invalid action', 400);
  } catch (error) {
    console.error('Error in notifications POST:', error);
    return createErrorResponse(error.message, 500);
  }
}

// Apply security middleware with message rate limiting
export const GET = withApiSecurity(handleGET, {
  rateLimitType: 'message'
});

export const POST = withApiSecurity(handlePOST, {
  rateLimitType: 'message',
  requiredFields: ['action'],
  validateBody: true
});