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

    if (!communityId) {
      return NextResponse.json({ error: 'Community ID is required' }, { status: 400 });
    }

    // Initialize admin SDK
    const db = getAdminFirestore();

    // Create a ReadableStream for SSE
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', message: 'Connected to notifications stream' })}\n\n`));

        let unsubscribe;
        const connectionTime = new Date();

        try {
          // Listen for new notifications
          const query = db.collection('notifications')
            .where('userId', '==', userId)
            .where('communityId', '==', communityId)
            .where('createdAt', '>', connectionTime) // Only new notifications
            .orderBy('createdAt', 'desc');

          unsubscribe = query.onSnapshot(
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
                  `data: ${JSON.stringify({ type: 'update', changes })}\n\n`
                ));
              }
            },
            (error) => {
              console.error('Notifications listener error:', error);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`));
              controller.close();
            }
          );
        } catch (error) {
          console.error('Error setting up listener:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`));
          controller.close();
        }

        // Handle cleanup when connection closes
        return () => {
          if (unsubscribe) {
            unsubscribe();
          }
        };
      },

      cancel() {
        console.log('Notifications SSE stream cancelled');
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
    console.error('Error in notifications SSE endpoint:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}