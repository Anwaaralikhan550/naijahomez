import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import logger from '@/lib/logger';

// Helper function to verify community membership
async function verifyCommunityMembership(db, userId, communityId) {
  const memberQuery = await db.collection('hubMembers')
    .where('userId', '==', userId)
    .where('communityId', '==', communityId)
    .where('isActive', '==', true)
    .limit(1)
    .get();

  return !memberQuery.empty;
}

export async function GET(request) {
  try {
    // SECURITY: Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const authenticatedUserId = authResult.userId;
    const db = getAdminFirestore();

    const { searchParams } = new URL(request.url);
    const communityId = searchParams.get('communityId');
    const channel = searchParams.get('channel');
    const messageLimit = Math.min(parseInt(searchParams.get('limit')) || 50, 100);

    if (!communityId || !channel) {
      return NextResponse.json({ error: 'Community ID and channel are required' }, { status: 400 });
    }

    // SECURITY: Verify community membership
    const isMember = await verifyCommunityMembership(db, authenticatedUserId, communityId);
    if (!isMember) {
      return NextResponse.json(
        { error: 'You are not a member of this community' },
        { status: 403 }
      );
    }

    const querySnapshot = await db.collection('chatMessages')
      .where('communityId', '==', communityId)
      .where('channel', '==', channel)
      .orderBy('createdAt', 'desc')
      .limit(messageLimit)
      .get();
    const messages = [];

    querySnapshot.forEach((doc) => {
      messages.push({ id: doc.id, ...doc.data() });
    });

    // Reverse to show oldest first
    messages.reverse();

    // Load reply information for messages that have replyToId
    const messagesWithReplies = await Promise.all(
      messages.map(async (message) => {
        if (message.replyToId) {
          try {
            const replyToSnap = await db.collection('chatMessages').doc(message.replyToId).get();
            if (replyToSnap.exists()) {
              message.replyTo = { id: replyToSnap.id, ...replyToSnap.data() };
            }
          } catch (error) {
            logger.error('Error loading reply message', error);
          }
        }
        return message;
      })
    );

    return NextResponse.json({ messages: messagesWithReplies });
  } catch (error) {
    logger.error('Error in chat messages GET', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    // SECURITY: Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const authenticatedUserId = authResult.userId;
    const db = getAdminFirestore();
    const body = await request.json();
    const { action, ...data } = body;

    if (action === 'send_message') {
      const {
        communityId,
        channel,
        content,
        authorName,
        replyToId,
        messageType = 'text',
        authorRole
      } = data;

      if (!communityId || !channel || !content) {
        return NextResponse.json({ error: 'Required fields missing' }, { status: 400 });
      }

      // SECURITY: Verify community membership
      const isMember = await verifyCommunityMembership(db, authenticatedUserId, communityId);
      if (!isMember) {
        return NextResponse.json(
          { error: 'You are not a member of this community' },
          { status: 403 }
        );
      }

      const messageData = {
        communityId,
        channel,
        content: content.trim(),
        authorId: authenticatedUserId, // SECURITY: Use authenticated user ID
        authorName,
        authorRole: authorRole || 'member',
        messageType,
        replyToId: replyToId || null,
        reactions: {},
        isEdited: false,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const docRef = await db.collection('chatMessages').add(messageData);
      return NextResponse.json({ messageId: docRef.id });
    }

    if (action === 'edit_message') {
      const { messageId, content } = data;

      if (!messageId || !content) {
        return NextResponse.json({ error: 'Message ID and content are required' }, { status: 400 });
      }

      // SECURITY: Verify ownership before editing
      const messageSnap = await db.collection('chatMessages').doc(messageId).get();
      if (!messageSnap.exists()) {
        return NextResponse.json({ error: 'Message not found' }, { status: 404 });
      }

      const messageData = messageSnap.data();
      if (messageData.authorId !== authenticatedUserId) {
        return NextResponse.json(
          { error: 'You can only edit your own messages' },
          { status: 403 }
        );
      }

      await db.collection('chatMessages').doc(messageId).update({
        content: content.trim(),
        isEdited: true,
        updatedAt: new Date()
      });

      return NextResponse.json({ success: true });
    }

    if (action === 'delete_message') {
      const { messageId } = data;

      if (!messageId) {
        return NextResponse.json({ error: 'Message ID is required' }, { status: 400 });
      }

      // SECURITY: Verify ownership before deleting
      const messageSnap = await db.collection('chatMessages').doc(messageId).get();
      if (!messageSnap.exists()) {
        return NextResponse.json({ error: 'Message not found' }, { status: 404 });
      }

      const messageData = messageSnap.data();
      if (messageData.authorId !== authenticatedUserId) {
        return NextResponse.json(
          { error: 'You can only delete your own messages' },
          { status: 403 }
        );
      }

      await db.collection('chatMessages').doc(messageId).update({
        isDeleted: true,
        content: '',
        deletedBy: authenticatedUserId,
        updatedAt: new Date()
      });

      return NextResponse.json({ success: true });
    }

    if (action === 'react_to_message') {
      const { messageId, emoji } = data;

      if (!messageId || !emoji) {
        return NextResponse.json({ error: 'Message ID and emoji are required' }, { status: 400 });
      }

      const messageSnap = await db.collection('chatMessages').doc(messageId).get();

      if (!messageSnap.exists()) {
        return NextResponse.json({ error: 'Message not found' }, { status: 404 });
      }

      const messageData = messageSnap.data();

      // SECURITY: Verify user is member of the community
      const isMember = await verifyCommunityMembership(db, authenticatedUserId, messageData.communityId);
      if (!isMember) {
        return NextResponse.json(
          { error: 'You are not a member of this community' },
          { status: 403 }
        );
      }

      const reactions = messageData.reactions || {};

      if (!reactions[emoji]) {
        reactions[emoji] = [];
      }

      // Toggle reaction using authenticated user ID
      const userIndex = reactions[emoji].indexOf(authenticatedUserId);
      if (userIndex > -1) {
        reactions[emoji].splice(userIndex, 1);
        if (reactions[emoji].length === 0) {
          delete reactions[emoji];
        }
      } else {
        reactions[emoji].push(authenticatedUserId);
      }

      await db.collection('chatMessages').doc(messageId).update({
        reactions,
        updatedAt: new Date()
      });

      return NextResponse.json({ success: true });
    }

    if (action === 'get_message_history') {
      const { communityId, channel, beforeTimestamp, messageLimit = 20 } = data;

      if (!communityId || !channel) {
        return NextResponse.json({ error: 'Community ID and channel are required' }, { status: 400 });
      }

      // SECURITY: Verify community membership
      const isMember = await verifyCommunityMembership(db, authenticatedUserId, communityId);
      if (!isMember) {
        return NextResponse.json(
          { error: 'You are not a member of this community' },
          { status: 403 }
        );
      }

      let query;
      const safeLimit = Math.min(messageLimit, 100);
      if (beforeTimestamp) {
        query = db.collection('chatMessages')
          .where('communityId', '==', communityId)
          .where('channel', '==', channel)
          .where('createdAt', '<', beforeTimestamp)
          .orderBy('createdAt', 'desc')
          .limit(safeLimit);
      } else {
        query = db.collection('chatMessages')
          .where('communityId', '==', communityId)
          .where('channel', '==', channel)
          .orderBy('createdAt', 'desc')
          .limit(safeLimit);
      }

      const querySnapshot = await query.get();
      const messages = [];

      querySnapshot.forEach((doc) => {
        messages.push({ id: doc.id, ...doc.data() });
      });

      messages.reverse();
      return NextResponse.json({ messages });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    logger.error('Error in chat messages POST', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
