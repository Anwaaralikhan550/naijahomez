export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';

const errorResponse = (message, code, status = 500) =>
  NextResponse.json({ success: false, error: message, code }, { status });

const authErrorResponse = async (authError) => {
  const status = authError?.status || 401;
  const payload = await authError?.clone?.().json?.().catch(() => ({}));
  const message = payload?.error || 'Authentication required';
  const code = status === 403 ? 'FORBIDDEN' : status === 503 ? 'AUTH_SERVICE_UNAVAILABLE' : 'UNAUTHORIZED';
  return errorResponse(message, code, status);
};

export async function GET(request) {
  try {
    // Verify authentication first
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authErrorResponse(authResult.error);
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || authResult.userId;

    if (!userId) {
      return errorResponse('User ID is required', 'USER_ID_REQUIRED', 400);
    }

    // Count messages sent by this user
    const db = getAdminFirestore();
    let messagesSentCount = 0;

    try {
      const countSnapshot = await db.collection('messages')
        .where('senderId', '==', userId)
        .count()
        .get();

      messagesSentCount = countSnapshot.data().count || 0;
    } catch (error) {
      try {
        const sentMessagesSnapshot = await db.collection('messages')
          .where('senderId', '==', userId)
          .get();

        messagesSentCount = sentMessagesSnapshot.size;
      } catch (fallbackError) {
        console.log('Messages collection might not exist or have different structure:', fallbackError.message);
      }
    }

    return NextResponse.json({ count: messagesSentCount });
  } catch (error) {
    console.error('Error fetching user messages count:', error);
    return errorResponse('Failed to fetch user messages count', 'USER_MESSAGES_COUNT_FAILED', 500);
  }
}
