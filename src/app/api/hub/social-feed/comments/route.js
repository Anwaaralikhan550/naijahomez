export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import logger from '@/lib/logger';

function errorResponse(message, code = 'INTERNAL_ERROR', status = 500) {
  return NextResponse.json({ success: false, error: message, code }, { status });
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

async function verifyCommunityMembership(db, userId, communityId) {
  const activeFlagQuery = await db.collection('hubMembers')
    .where('userId', '==', userId)
    .where('communityId', '==', communityId)
    .where('isActive', '==', true)
    .limit(1)
    .get();

  if (!activeFlagQuery.empty) {
    return true;
  }

  const activeStatusQuery = await db.collection('hubMembers')
    .where('userId', '==', userId)
    .where('communityId', '==', communityId)
    .where('status', '==', 'active')
    .limit(1)
    .get();

  return !activeStatusQuery.empty;
}



export async function GET(request) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authFailureResponse(authResult.error);
    }

    const authenticatedUserId = authResult.userId;

    // Initialize admin SDK
    const db = getAdminFirestore();

    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId');
    const limit = parseInt(searchParams.get('limit')) || 5;

    if (!postId) {
      return errorResponse('Post ID is required', 'VALIDATION_ERROR', 400);
    }

    const postSnap = await db.collection('socialPosts').doc(postId).get();
    if (!postSnap.exists) {
      return errorResponse('Post not found', 'NOT_FOUND', 404);
    }

    const postData = postSnap.data();
    const isMember = await verifyCommunityMembership(db, authenticatedUserId, postData.communityId);
    if (!isMember) {
      return errorResponse('You are not a member of this community', 'FORBIDDEN', 403);
    }

    // Load comments for specific post
    const commentsQuery = db.collection('socialComments')
      .where('postId', '==', postId)
      .orderBy('createdAt', 'asc')
      .limit(limit);
    
    const commentsSnapshot = await commentsQuery.get();
    const comments = [];
    
    commentsSnapshot.forEach((commentDoc) => {
      const commentData = commentDoc.data();
      if (commentData.isActive === false) {
        return;
      }

      comments.push({ 
        id: commentDoc.id, 
        ...commentData,
        createdAt: commentData.createdAt?.toDate?.().toISOString() || commentData.createdAt
      });
    });

    return NextResponse.json({ comments });
  } catch (error) {
    logger.error('Error loading comments', error);
    return errorResponse(error.message, 'INTERNAL_ERROR', 500);
  }
}
