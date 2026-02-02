import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import { 
  withApiSecurity, 
  createErrorResponse, 
  createSuccessResponse,
  sanitizeInput 
} from '@/lib/api-validation-middleware';

// In-memory store for SSE connections (in production, use Redis or similar)
const sseConnections = new Map();

// Store SSE connection
export function addSSEConnection(communityId, userId, response) {
  if (!sseConnections.has(communityId)) {
    sseConnections.set(communityId, new Map());
  }
  sseConnections.get(communityId).set(userId, response);
}

// Remove SSE connection
export function removeSSEConnection(communityId, userId) {
  const communityConnections = sseConnections.get(communityId);
  if (communityConnections) {
    communityConnections.delete(userId);
    if (communityConnections.size === 0) {
      sseConnections.delete(communityId);
    }
  }
}

// Broadcast message to all SSE connections in a community
export function broadcastToSSE(communityId, message, excludeUserId = null) {
  const communityConnections = sseConnections.get(communityId);
  if (!communityConnections) return;

  const encoder = new TextEncoder();
  const data = `data: ${JSON.stringify(message)}\n\n`;
  const encodedData = encoder.encode(data);

  communityConnections.forEach((response, userId) => {
    if (excludeUserId && userId === excludeUserId) return;
    
    try {
      const controller = response.getWriter();
      controller.write(encodedData);
    } catch (error) {
      console.error('Failed to broadcast to SSE connection:', error);
      // Remove broken connection
      communityConnections.delete(userId);
    }
  });
}

async function handlePOST(request) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const userId = authResult.userId;
    const body = request.parsedBody;
    const { communityId, message, excludeSelf = true } = body;

    if (!communityId || !message) {
      return createErrorResponse('Community ID and message are required', 400);
    }

    // Sanitize message
    const sanitizedMessage = sanitizeInput(message);

    // Broadcast to all SSE connections in the community
    broadcastToSSE(
      communityId, 
      sanitizedMessage, 
      excludeSelf ? userId : null
    );

    return createSuccessResponse({ 
      message: 'Message broadcasted successfully',
      connections: sseConnections.get(communityId)?.size || 0
    });

  } catch (error) {
    console.error('Error in broadcast API:', error);
    return createErrorResponse('Failed to broadcast message', 500);
  }
}

// Apply security middleware
export const POST = withApiSecurity(handlePOST, {
  rateLimitType: 'user',
  rateLimitMax: 100, // Allow many broadcasts per minute
  rateLimitWindowMs: 60000,
  validateBody: true,
  requiredFields: ['communityId', 'message']
});