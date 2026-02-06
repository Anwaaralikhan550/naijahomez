import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';

export async function GET(request) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const userId = authResult.userId;
    const { searchParams } = new URL(request.url);
    const communityId = searchParams.get('communityId');
    const conversationId = searchParams.get('conversationId');

    if (!communityId) {
      return NextResponse.json({ error: 'Community ID is required' }, { status: 400 });
    }

    // Initialize admin SDK
    const db = getAdminFirestore();

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}