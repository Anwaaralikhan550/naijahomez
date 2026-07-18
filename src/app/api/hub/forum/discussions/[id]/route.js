export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth, isAdmin } from '@/lib/auth-middleware';

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



export async function GET(request, { params }) {
  try {
    // Initialize admin SDK
    const db = getAdminFirestore();

    // Verify authentication for Hub forum access
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authFailureResponse(authResult.error);
    }

    const userId = authResult.userId;
    const discussionId = params.id;

    if (!discussionId) {
      return errorResponse('Discussion ID is required', 'VALIDATION_ERROR', 400);
    }

    // Get discussion details
    const discussionSnap = await db.collection('forumDiscussions').doc(discussionId).get();

    if (!discussionSnap.exists()) {
      return errorResponse('Discussion not found', 'NOT_FOUND', 404);
    }

    const discussion = { id: discussionSnap.id, ...discussionSnap.data() };

    // Get replies
    const repliesSnapshot = await db.collection('forumReplies')
      .where('discussionId', '==', discussionId)
      .orderBy('createdAt', 'asc')
      .get();
    const replies = [];
    repliesSnapshot.forEach((doc) => {
      replies.push({ id: doc.id, ...doc.data() });
    });

    discussion.replies = replies;

    // Increment view count
    await db.collection('forumDiscussions').doc(discussionId).update({
      viewCount: admin.firestore.FieldValue.increment(1)
    });

    return NextResponse.json({ discussion });
  } catch (error) {
    console.error('Error in forum discussion GET:', error);
    return errorResponse(error.message, 'INTERNAL_ERROR', 500);
  }
}