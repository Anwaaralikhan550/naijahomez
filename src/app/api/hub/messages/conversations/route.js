export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth, isAdmin } from '@/lib/auth-middleware';

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
    const userId = searchParams.get('userId');
    const communityId = searchParams.get('communityId');

    if (!userId || !communityId) {
      return errorResponse('User ID and Community ID are required', 'VALIDATION_ERROR', 400);
    }

    // Query without orderBy to avoid composite index requirement
    const querySnapshot = await db.collection('privateConversations')
      .where('communityId', '==', communityId)
      .where('participantIds', 'array-contains', userId)
      .get();
    const conversations = [];

    for (const conversationDoc of querySnapshot.docs) {
      const data = conversationDoc.data();
      // Convert Firestore timestamps to serializable format
      if (data.createdAt && typeof data.createdAt.toDate === 'function') {
        data.createdAt = data.createdAt.toDate().toISOString();
      }
      if (data.updatedAt && typeof data.updatedAt.toDate === 'function') {
        data.updatedAt = data.updatedAt.toDate().toISOString();
      }
      const conversationData = { id: conversationDoc.id, ...data };

      // Get the other participant info
      const otherParticipantId = conversationData.participantIds.find(id => id !== userId);
      const participantNames = Array.isArray(conversationData.participantNames)
        ? conversationData.participantNames
        : [];
      const otherParticipantName = participantNames.find((name, index) =>
        conversationData.participantIds[index] !== userId
      ) || 'Member';

      conversationData.otherParticipant = {
        id: otherParticipantId,
        name: otherParticipantName,
        isOnline: false // TODO: Implement online status
      };

      // Count unread messages
      const unreadSnapshot = await db.collection('privateMessages')
        .where('conversationId', '==', conversationDoc.id)
        .where('senderId', '!=', userId)
        .where('isRead', '==', false)
        .get();
      conversationData.unreadCount = unreadSnapshot.size;

      conversations.push(conversationData);
    }

    // Sort by updatedAt descending (client-side to avoid composite index)
    conversations.sort((a, b) => {
      const aTime = new Date(a.updatedAt || 0).getTime();
      const bTime = new Date(b.updatedAt || 0).getTime();
      return bTime - aTime;
    });

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error('Error in conversations GET:', error);
    return errorResponse(error.message, 'INTERNAL_ERROR', 500);
  }
}

export async function POST(request) {
  try {
    // Initialize admin SDK
    const db = getAdminFirestore();

    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authFailureResponse(authResult.error);
    }

    const userId = authResult.userId;
    const body = await request.json();
    const { action, ...data } = body;

    if (action === 'create_conversation') {
      const {
        communityId,
        participantIds,
        participantNames
      } = data;

      const normalizedParticipantIds = Array.isArray(participantIds)
        ? participantIds
            .map((id) => (typeof id === 'string' ? id.trim() : ''))
            .filter(Boolean)
        : [];

      const uniqueParticipantIds = [...new Set(normalizedParticipantIds)];
      if (!communityId || uniqueParticipantIds.length !== 2 || !uniqueParticipantIds.includes(userId)) {
        return errorResponse('Invalid conversation data', 'VALIDATION_ERROR', 400);
      }

      const participantNameMap = new Map();
      if (Array.isArray(participantNames)) {
        uniqueParticipantIds.forEach((id, index) => {
          const value = participantNames[index];
          if (typeof value === 'string' && value.trim()) {
            participantNameMap.set(id, value.trim());
          }
        });
      }

      const sortedParticipantIds = [...uniqueParticipantIds].sort();
      const sortedParticipantNames = sortedParticipantIds.map((id) => {
        if (participantNameMap.has(id)) {
          return participantNameMap.get(id);
        }
        return id === userId ? 'You' : 'Member';
      });

      // Check if conversation already exists between these participants
      const existingSnapshot = await db.collection('privateConversations')
        .where('communityId', '==', communityId)
        .where('participantIds', '==', sortedParticipantIds)
        .get();
      
      if (!existingSnapshot.empty) {
        // Return existing conversation
        const existingConversation = existingSnapshot.docs[0];
        return NextResponse.json({ 
          conversationId: existingConversation.id,
          exists: true 
        });
      }

      // Create new conversation
      const conversationData = {
        communityId,
        participantIds: sortedParticipantIds,
        participantNames: sortedParticipantNames,
        createdBy: userId,
        lastMessage: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const docRef = await db.collection('privateConversations').add(conversationData);
      return NextResponse.json({ 
        conversationId: docRef.id,
        exists: false 
      });
    }

    if (action === 'update_conversation') {
      const { conversationId, ...updateData } = data;
      
      if (!conversationId) {
        return errorResponse('Conversation ID is required', 'VALIDATION_ERROR', 400);
      }

      await db.collection('privateConversations').doc(conversationId).update({
        ...updateData,
        updatedAt: new Date()
      });

      return NextResponse.json({ success: true });
    }

    if (action === 'archive_conversation') {
      const { conversationId, userId } = data;
      
      if (!conversationId || !userId) {
        return errorResponse('Conversation ID and user ID are required', 'VALIDATION_ERROR', 400);
      }

      const conversationSnap = await db.collection('privateConversations').doc(conversationId).get();
      
      if (!conversationSnap.exists()) {
        return errorResponse('Conversation not found', 'NOT_FOUND', 404);
      }

      const conversationData = conversationSnap.data();
      const archivedBy = conversationData.archivedBy || [];
      
      if (!archivedBy.includes(userId)) {
        archivedBy.push(userId);
        await db.collection('privateConversations').doc(conversationId).update({
          archivedBy,
          updatedAt: new Date()
        });
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'delete_conversation') {
      const { conversationId, userId } = data;
      
      if (!conversationId || !userId) {
        return errorResponse('Conversation ID and user ID are required', 'VALIDATION_ERROR', 400);
      }

      const conversationSnap = await db.collection('privateConversations').doc(conversationId).get();
      
      if (!conversationSnap.exists()) {
        return errorResponse('Conversation not found', 'NOT_FOUND', 404);
      }

      const conversationData = conversationSnap.data();
      const deletedBy = conversationData.deletedBy || [];
      
      if (!deletedBy.includes(userId)) {
        deletedBy.push(userId);
        await db.collection('privateConversations').doc(conversationId).update({
          deletedBy,
          updatedAt: new Date()
        });
      }

      // If both participants have deleted, mark as inactive
      if (deletedBy.length === conversationData.participantIds.length) {
        await db.collection('privateConversations').doc(conversationId).update({
          isActive: false
        });
      }

      return NextResponse.json({ success: true });
    }

    return errorResponse('Invalid action', 'VALIDATION_ERROR', 400);
  } catch (error) {
    console.error('Error in conversations POST:', error);
    return errorResponse(error.message, 'INTERNAL_ERROR', 500);
  }
}
