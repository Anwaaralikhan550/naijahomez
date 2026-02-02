import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import { addSSEConnection, removeSSEConnection } from '@/app/api/hub/broadcast/route';

// Server-Sent Events endpoint for real-time updates
export async function GET(request, { params }) {
  try {
    const { communityId } = params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Create SSE response
    const encoder = new TextEncoder();
    
    const customReadable = new ReadableStream({
      start(controller) {
        // Register this connection for broadcasting
        addSSEConnection(communityId, userId, { getWriter: () => controller });
        
        // Send initial connection message
        const data = `data: ${JSON.stringify({
          type: 'connected',
          communityId,
          userId,
          timestamp: new Date().toISOString()
        })}\n\n`;
        controller.enqueue(encoder.encode(data));

        // Set up periodic heartbeat (every 30 seconds)
        const heartbeat = setInterval(() => {
          try {
            const heartbeatData = `data: ${JSON.stringify({
              type: 'heartbeat',
              timestamp: new Date().toISOString()
            })}\n\n`;
            controller.enqueue(encoder.encode(heartbeatData));
          } catch (error) {
            console.error('Heartbeat error:', error);
            clearInterval(heartbeat);
            controller.close();
          }
        }, 30000);

        // Simulate periodic notifications (in production, this would come from database changes)
        const notificationCheck = setInterval(async () => {
          try {
            // Check for new notifications for this user/community
            // This is where you'd query your database for recent updates
            const mockNotification = {
              type: 'notification',
              communityId,
              userId,
              data: {
                id: Math.random().toString(36).substr(2, 9),
                title: 'Community Update',
                message: 'New activity in your community',
                timestamp: new Date().toISOString(),
                read: false
              }
            };
            
            // Only send occasionally to simulate real notifications
            if (Math.random() < 0.1) { // 10% chance every check
              const notificationData = `data: ${JSON.stringify(mockNotification)}\n\n`;
              controller.enqueue(encoder.encode(notificationData));
            }
          } catch (error) {
            console.error('Notification check error:', error);
          }
        }, 10000); // Check every 10 seconds

        // Cleanup on connection close
        request.signal.addEventListener('abort', () => {
          clearInterval(heartbeat);
          clearInterval(notificationCheck);
          removeSSEConnection(communityId, userId);
          controller.close();
        });
      }
    });

    return new Response(customReadable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      }
    });

  } catch (error) {
    console.error('SSE endpoint error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}