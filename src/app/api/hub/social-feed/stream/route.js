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
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authFailureResponse(authResult.error);
    }

    const { searchParams } = new URL(request.url);
    const communityId = searchParams.get('communityId');

    if (!communityId) {
      return errorResponse('Community ID is required', 'VALIDATION_ERROR', 400);
    }

    // Initialize admin SDK
    const db = getAdminFirestore();

    // Create a ReadableStream for SSE
    const stream = new ReadableStream({
      start(controller) {
        // Send initial connection message
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', message: 'Connected to social feed' })}\n\n`));

        let unsubscribe;

        // Set up Firestore listener for real-time updates
        const setupListener = () => {
          try {
            // Only listen for NEW posts created after connection time
            const connectionTime = new Date();
            
            const query = db.collection('socialPosts')
              .where('communityId', '==', communityId)
              .where('isActive', '==', true)
              .where('createdAt', '>', connectionTime) // Only posts created after connection
              .orderBy('createdAt', 'desc');

            unsubscribe = query.onSnapshot(
              async (snapshot) => {
                try {
                  // Process document changes
                  const changes = snapshot.docChanges().map(change => ({
                    type: change.type,
                    doc: {
                      id: change.doc.id,
                      ...change.doc.data(),
                      createdAt: change.doc.data().createdAt?.toDate?.().toISOString() || change.doc.data().createdAt
                    }
                  }));

                  if (changes.length > 0) {
                    // Only send changes without loading comments
                    // Comments will be loaded on-demand by the client
                    const message = {
                      type: 'update',
                      changes: changes.map(change => ({
                        ...change,
                        doc: {
                          ...change.doc,
                          comments: [] // Empty comments array - load on demand
                        }
                      }))
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
        // Cleanup when stream is cancelled
        console.log('SSE stream cancelled');
      }
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    console.error('Error in SSE endpoint:', error);
    return errorResponse(error.message, 'INTERNAL_ERROR', 500);
  }
}