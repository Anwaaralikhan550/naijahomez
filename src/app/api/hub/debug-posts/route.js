export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';

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



export async function GET(request) {
  try {
    // SECURITY: Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authFailureResponse(authResult.error);
    }

    // Initialize admin SDK
    const db = getAdminFirestore();

    const { searchParams } = new URL(request.url);
    const communityId = searchParams.get('communityId');

    if (!communityId) {
      return errorResponse('Community ID is required', 'VALIDATION_ERROR', 400);
    }


    // Get all posts for this community
    const querySnapshot = await db.collection('socialPosts')
      .where('communityId', '==', communityId)
      .where('isActive', '==', true)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    const posts = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      posts.push({
        id: doc.id,
        type: data.type,
        content: data.content?.substring(0, 50) + '...',
        createdAt: data.createdAt,
        authorName: data.authorName
      });
    });


    return NextResponse.json({ 
      communityId,
      totalPosts: posts.length,
      posts,
      typeBreakdown: posts.reduce((acc, post) => {
        acc[post.type] = (acc[post.type] || 0) + 1;
        return acc;
      }, {})
    });
  } catch (error) {
    console.error('Error in debug posts GET:', error);
    return errorResponse(error.message, 'INTERNAL_ERROR', 500);
  }
}