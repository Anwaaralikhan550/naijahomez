import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth, isAdmin } from '@/lib/auth-middleware';

export async function GET(request) {
  try {
    // SECURITY: Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    // Initialize admin SDK
    const db = getAdminFirestore();

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const communityId = searchParams.get('communityId');

    if (!userId || !communityId) {
      return NextResponse.json({ error: 'User ID and Community ID are required' }, { status: 400 });
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
      const otherParticipantName = conversationData.participantNames.find((name, index) =>
        conversationData.participantIds[index] !== userId
      );

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    // Initialize admin SDK
    const db = getAdminFirestore();

    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const userId = authResult.userId;
    const body = await request.json();
    const { action, ...data } = body;

    if (action === 'create_conversation') {
      const {
        communityId,
        participantIds,
        participantNames,
        createdBy
      } = data;

      if (!communityId || !participantIds || participantIds.length !== 2 || !participantNames) {
        return NextResponse.json({ error: 'Invalid conversation data' }, { status: 400 });
      }

      // Check if conversation already exists between these participants
      const existingSnapshot = await db.collection('privateConversations')
        .where('communityId', '==', communityId)
        .where('participantIds', '==', participantIds.sort())
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
        participantIds: participantIds.sort(),
        participantNames,
        createdBy,
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
        return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
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
        return NextResponse.json({ error: 'Conversation ID and user ID are required' }, { status: 400 });
      }

      const conversationSnap = await db.collection('privateConversations').doc(conversationId).get();
      
      if (!conversationSnap.exists()) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
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
        return NextResponse.json({ error: 'Conversation ID and user ID are required' }, { status: 400 });
      }

      const conversationSnap = await db.collection('privateConversations').doc(conversationId).get();
      
      if (!conversationSnap.exists()) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
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

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in conversations POST:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}