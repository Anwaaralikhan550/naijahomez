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

    const { searchParams } = new URL(request.url);
    const communityId = searchParams.get('communityId');
    const channelId = searchParams.get('channelId');

    if (!communityId || !channelId) {
      return NextResponse.json({ error: 'Community ID and Channel ID are required' }, { status: 400 });
    }

    // Initialize admin SDK
    const db = getAdminFirestore();

    // Create a ReadableStream for SSE
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', message: 'Connected to chat stream' })}\n\n`));

        let unsubscribe;

        // Set up Firestore listener for real-time updates
        const setupListener = () => {
          try {
            // Get the current time to only listen for new messages
            const connectionTime = new Date();
            
            const query = db.collection('chatMessages')
              .where('communityId', '==', communityId)
              .where('channelId', '==', channelId)
              .where('createdAt', '>', connectionTime) // Only new messages
              .orderBy('createdAt', 'asc');

            unsubscribe = query.onSnapshot(
              (snapshot) => {
                try {
                  const changes = snapshot.docChanges().map(change => ({
                    type: change.type,
                    doc: {
                      id: change.doc.id,
                      ...change.doc.data(),
                      createdAt: change.doc.data().createdAt?.toDate?.().toISOString() || change.doc.data().createdAt
                    }
                  }));

                  if (changes.length > 0) {
                    const message = {
                      type: 'update',
                      changes
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(message)}\n\n`));
                  }
                } catch (error) {
                  console.error('Error processing snapshot:', error);
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`));
                }
              },
              (error) => {
                console.error('Firestore listener error:', error);
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`));
                controller.close();
              }
            );
          } catch (error) {
            console.error('Error setting up listener:', error);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`));
            controller.close();
          }
        };

        setupListener();

        // Handle cleanup when connection closes
        return () => {
          if (unsubscribe) {
            unsubscribe();
          }
        };
      },

      cancel() {
        console.log('Chat SSE stream cancelled');
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
    console.error('Error in chat SSE endpoint:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}