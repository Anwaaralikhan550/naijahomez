import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth, isAdmin } from '@/lib/auth-middleware';
import { 
  withApiSecurity, 
  createErrorResponse, 
  createSuccessResponse,
  sanitizeInput 
} from '@/lib/api-validation-middleware';

async function handlePOST(request) {
  try {
    // Initialize admin SDK
    const db = getAdminFirestore();

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

    if (action === 'create_reply') {
      const {
        discussionId,
        content,
        authorId,
        authorName,
        parentReplyId // For nested replies
      } = sanitizedData;

      if (!discussionId || !content || !authorId) {
        return createErrorResponse('Required fields missing', 400);
      }

      const replyData = {
        discussionId,
        content: content.trim(),
        authorId,
        authorName,
        parentReplyId: parentReplyId || null,
        likes: 0,
        isModerated: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Create the reply
      const docRef = await db.collection('forumReplies').add(replyData);

      // Update discussion reply count and last activity
      await db.collection('forumDiscussions').doc(discussionId).update({
        replyCount: admin.firestore.FieldValue.increment(1),
        lastActivityAt: new Date(),
        lastReplyAt: new Date(),
        lastReplyBy: authorName
      });

      return createSuccessResponse({ replyId: docRef.id }, 'Reply created successfully');
    }

    if (action === 'like_reply') {
      const { replyId, userId } = sanitizedData;
      
      if (!replyId || !userId) {
        return createErrorResponse('Reply ID and User ID are required', 400);
      }

      // TODO: Implement like tracking to prevent multiple likes from same user
      await db.collection('forumReplies').doc(replyId).update({
        likes: admin.firestore.FieldValue.increment(1),
        updatedAt: new Date()
      });

      return createSuccessResponse({}, 'Reply liked successfully');
    }

    if (action === 'update_reply') {
      const { replyId, content } = sanitizedData;
      
      if (!replyId || !content) {
        return createErrorResponse('Reply ID and content are required', 400);
      }

      await db.collection('forumReplies').doc(replyId).update({
        content: content.trim(),
        updatedAt: new Date(),
        isEdited: true
      });

      return createSuccessResponse({}, 'Reply updated successfully');
    }

    if (action === 'moderate_reply') {
      const { replyId, isModerated, moderatedBy } = sanitizedData;
      
      if (!replyId) {
        return createErrorResponse('Reply ID is required', 400);
      }

      await db.collection('forumReplies').doc(replyId).update({
        isModerated: isModerated || false,
        moderatedBy: moderatedBy || null,
        moderatedAt: isModerated ? new Date() : null,
        updatedAt: new Date()
      });

      return createSuccessResponse({}, 'Reply moderated successfully');
    }

    return createErrorResponse('Invalid action', 400);
  } catch (error) {
    console.error('Error in forum replies POST:', error);
    return createErrorResponse(error.message, 500);
  }
}

// Apply security middleware with message rate limiting
export const POST = withApiSecurity(handlePOST, {
  rateLimitType: 'message',
  requiredFields: ['action'],
  validateBody: true
});