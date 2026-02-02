import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth, isAdmin } from '@/lib/auth-middleware';
import { 
  withApiSecurity, 
  createErrorResponse, 
  createSuccessResponse,
  sanitizeInput 
} from '@/lib/api-validation-middleware';

async function handleGET(request) {
  try {
    // Initialize admin SDK
    const db = getAdminFirestore();

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');
    const messageLimit = parseInt(searchParams.get('limit')) || 50;

    if (!conversationId) {
      return createErrorResponse('Conversation ID is required', 400);
    }

    const querySnapshot = await db.collection('privateMessages')
      .where('conversationId', '==', conversationId)
      .orderBy('createdAt', 'desc')
      .limit(messageLimit)
      .get();
    const messages = [];
    
    querySnapshot.forEach((doc) => {
      messages.push({ id: doc.id, ...doc.data() });
    });

    // Reverse to show oldest first
    messages.reverse();

    return createSuccessResponse({ messages });
  } catch (error) {
    console.error('Error in private messages GET:', error);
    return createErrorResponse(error.message, 500);
  }
}

async function handlePOST(request) {
  try {
    // Initialize admin SDK
    const db = getAdminFirestore();

    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const userId = authResult.userId;
    const body = request.parsedBody;
    const { action, ...data } = body;

    // Sanitize input data
    const sanitizedData = sanitizeInput(data);

    if (action === 'send_message') {
      const {
        conversationId,
        content,
        senderId,
        senderName,
        messageType = 'text'
      } = sanitizedData;

      if (!conversationId || !content || !senderId) {
        return createErrorResponse('Required fields missing', 400);
      }

      const messageData = {
        conversationId,
        content: content.trim(),
        senderId,
        senderName,
        messageType,
        isRead: false,
        isEdited: false,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const docRef = await db.collection('privateMessages').add(messageData);

      // Update conversation with last message info
      await db.collection('privateConversations').doc(conversationId).update({
        lastMessage: {
          content: content.trim(),
          senderId,
          senderName,
          createdAt: new Date()
        },
        updatedAt: new Date()
      });

      return createSuccessResponse({ messageId: docRef.id }, 'Message sent successfully');
    }

    if (action === 'mark_as_read') {
      const { conversationId, userId } = sanitizedData;
      
      if (!conversationId || !userId) {
        return createErrorResponse('Conversation ID and user ID are required', 400);
      }

      // Mark all unread messages in conversation as read for this user
      const unreadSnapshot = await db.collection('privateMessages')
        .where('conversationId', '==', conversationId)
        .where('senderId', '!=', userId)
        .where('isRead', '==', false)
        .get();
      const updatePromises = [];
      
      unreadSnapshot.forEach((messageDoc) => {
        updatePromises.push(
          db.collection('privateMessages').doc(messageDoc.id).update({
            isRead: true,
            readAt: new Date()
          })
        );
      });

      await Promise.all(updatePromises);
      return createSuccessResponse({}, 'Messages marked as read');
    }

    if (action === 'edit_message') {
      const { messageId, content } = sanitizedData;
      
      if (!messageId || !content) {
        return createErrorResponse('Message ID and content are required', 400);
      }

      await db.collection('privateMessages').doc(messageId).update({
        content: content.trim(),
        isEdited: true,
        updatedAt: new Date()
      });

      return createSuccessResponse({}, 'Message updated successfully');
    }

    if (action === 'delete_message') {
      const { messageId } = sanitizedData;
      
      if (!messageId) {
        return createErrorResponse('Message ID is required', 400);
      }

      await db.collection('privateMessages').doc(messageId).update({
        isDeleted: true,
        content: '',
        updatedAt: new Date()
      });

      return createSuccessResponse({}, 'Message deleted successfully');
    }

    return createErrorResponse('Invalid action', 400);
  } catch (error) {
    console.error('Error in private messages POST:', error);
    return createErrorResponse(error.message, 500);
  }
}

// Apply security middleware with message rate limiting
export const GET = withApiSecurity(handleGET, {
  rateLimitType: 'message'
});

export const POST = withApiSecurity(handlePOST, {
  rateLimitType: 'message',
  requiredFields: ['action'],
  validateBody: true
});