export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import { isUserActiveCommunityMember } from '@/lib/hubFirestore';

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
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authFailureResponse(authResult.error);
    }

    const userId = authResult.userId;
    const { searchParams } = new URL(request.url);
    const communityId = searchParams.get('communityId');
    const conversationId = searchParams.get('conversationId');

    if (!communityId) {
      return errorResponse('Community ID is required', 'VALIDATION_ERROR', 400);
    }

    // Initialize admin SDK
    const db = getAdminFirestore();
    const isMember = await isUserActiveCommunityMember(userId, communityId);
    if (!isMember) {
      return errorResponse('You are not a member of this community', 'FORBIDDEN', 403);
    }

    if (conversationId) {
      const conversationDoc = await db.collection('privateConversations').doc(conversationId).get();
      if (!conversationDoc.exists) {
        return errorResponse('Conversation not found', 'NOT_FOUND', 404);
      }

      const conversationData = conversationDoc.data() || {};
      const participantIds = Array.isArray(conversationData.participantIds) ? conversationData.participantIds : [];
      if (!participantIds.includes(userId)) {
        return errorResponse('Access denied for this conversation', 'FORBIDDEN', 403);
      }
    }

    // Create a ReadableStream for SSE
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', message: 'Connected to messages stream' })}\n\n`));

        const unsubscribes = [];
        const connectionTime = new Date();

        try {
          if (conversationId) {
            // Listen for new messages in specific conversation
            const messagesQuery = db.collection('privateMessages')
              .where('conversationId', '==', conversationId)
              .where('createdAt', '>', connectionTime)
              .orderBy('createdAt', 'asc');

            const unsubscribeMessages = messagesQuery.onSnapshot(
              (snapshot) => {
                const changes = snapshot.docChanges().map(change => ({
                  type: change.type,
                  doc: {
                    id: change.doc.id,
                    ...change.doc.data(),
                    createdAt: change.doc.data().createdAt?.toDate?.().toISOString() || change.doc.data().createdAt
                  }
                }));

                if (changes.length > 0) {
                  controller.enqueue(encoder.encode(
                    `data: ${JSON.stringify({ type: 'messages', changes })}\n\n`
                  ));
                }
              },
              (error) => {
                console.error('Messages listener error:', error);
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`));
              }
            );
            unsubscribes.push(unsubscribeMessages);
          } else {
            // Listen for conversation updates
            const conversationsQuery = db.collection('privateConversations')
              .where('participantIds', 'array-contains', userId)
              .where('communityId', '==', communityId);

            const unsubscribeConversations = conversationsQuery.onSnapshot(
              (snapshot) => {
                const changes = snapshot.docChanges().map(change => ({
                  type: change.type,
                  doc: {
                    id: change.doc.id,
                    ...change.doc.data(),
                    updatedAt: change.doc.data().updatedAt?.toDate?.().toISOString() || change.doc.data().updatedAt
                  }
                }));

                if (changes.length > 0) {
                  controller.enqueue(encoder.encode(
                    `data: ${JSON.stringify({ type: 'conversations', changes })}\n\n`
                  ));
                }
              },
              (error) => {
                console.error('Conversations listener error:', error);
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`));
              }
            );
            unsubscribes.push(unsubscribeConversations);
          }
        } catch (error) {
          console.error('Error setting up listeners:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`));
          controller.close();
        }

        // Handle cleanup when connection closes
        return () => {
          unsubscribes.forEach(unsubscribe => unsubscribe());
        };
      },

      cancel() {
        console.log('Messages SSE stream cancelled');
      }
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Error in messages SSE endpoint:', error);
    return errorResponse(error.message, 'INTERNAL_ERROR', 500);
  }
}
