import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth, isAdmin } from '@/lib/auth-middleware';
import { 
  withApiSecurity, 
  createErrorResponse, 
  createSuccessResponse,
  sanitizeInput 
} from '@/lib/api-validation-middleware';

async function handleGET(request) {
  try {
    // Initialize admin SDK
    const db = getAdminFirestore();

    const { searchParams } = new URL(request.url);
    const communityId = searchParams.get('communityId');
    const category = searchParams.get('category');

    if (!communityId) {
      return createErrorResponse('Community ID is required', 400);
    }

    let query;
    if (category) {
      query = db.collection('forumDiscussions')
        .where('communityId', '==', communityId)
        .where('categoryId', '==', category)
        .orderBy('isPinned', 'desc')
        .orderBy('lastActivityAt', 'desc');
    } else {
      query = db.collection('forumDiscussions')
        .where('communityId', '==', communityId)
        .orderBy('isPinned', 'desc')
        .orderBy('lastActivityAt', 'desc');
    }

    const querySnapshot = await query.get();
    const discussions = [];
    querySnapshot.forEach((doc) => {
      discussions.push({ id: doc.id, ...doc.data() });
    });

    return createSuccessResponse({ discussions });
  } catch (error) {
    console.error('Error in forum discussions GET:', error);
    return createErrorResponse(error.message, 500);
  }
}

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

    if (action === 'create_discussion') {
      const {
        communityId,
        categoryId,
        title,
        content,
        isPinned,
        authorId,
        authorName
      } = sanitizedData;

      if (!communityId || !categoryId || !title || !content || !authorId) {
        return createErrorResponse('Required fields missing', 400);
      }

      const discussionData = {
        communityId,
        categoryId,
        title: title.trim(),
        content: content.trim(),
        isPinned: isPinned || false,
        authorId,
        authorName,
        replyCount: 0,
        viewCount: 0,
        likes: 0,
        isLocked: false,
        createdAt: new Date(),
        lastActivityAt: new Date(),
        lastReplyAt: null,
        lastReplyBy: null
      };

      const docRef = await db.collection('forumDiscussions').add(discussionData);
      return createSuccessResponse({ discussionId: docRef.id }, 'Discussion created successfully');
    }

    if (action === 'update_discussion') {
      const { discussionId, ...updateData } = sanitizedData;
      
      if (!discussionId) {
        return createErrorResponse('Discussion ID is required', 400);
      }

      await db.collection('forumDiscussions').doc(discussionId).update({
        ...updateData,
        lastActivityAt: new Date()
      });

      return createSuccessResponse({}, 'Discussion updated successfully');
    }

    if (action === 'increment_views') {
      const { discussionId } = sanitizedData;
      
      if (!discussionId) {
        return createErrorResponse('Discussion ID is required', 400);
      }

      await db.collection('forumDiscussions').doc(discussionId).update({
        viewCount: admin.firestore.FieldValue.increment(1)
      });

      return createSuccessResponse({}, 'View count updated');
    }

    return createErrorResponse('Invalid action', 400);
  } catch (error) {
    console.error('Error in forum discussions POST:', error);
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