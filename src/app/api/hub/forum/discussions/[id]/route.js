import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth, isAdmin } from '@/lib/auth-middleware';

export async function GET(request, { params }) {
  try {
    // Initialize admin SDK
    const db = getAdminFirestore();

    // Verify authentication for Hub forum access
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const userId = authResult.userId;
    const discussionId = params.id;

    if (!discussionId) {
      return NextResponse.json({ error: 'Discussion ID is required' }, { status: 400 });
    }

    // Get discussion details
    const discussionSnap = await db.collection('forumDiscussions').doc(discussionId).get();

    if (!discussionSnap.exists()) {
      return NextResponse.json({ error: 'Discussion not found' }, { status: 404 });
    }

    const discussion = { id: discussionSnap.id, ...discussionSnap.data() };

    // Get replies
    const repliesSnapshot = await db.collection('forumReplies')
      .where('discussionId', '==', discussionId)
      .orderBy('createdAt', 'asc')
      .get();
    const replies = [];
    repliesSnapshot.forEach((doc) => {
      replies.push({ id: doc.id, ...doc.data() });
    });

    discussion.replies = replies;

    // Increment view count
    await db.collection('forumDiscussions').doc(discussionId).update({
      viewCount: admin.firestore.FieldValue.increment(1)
    });

    return NextResponse.json({ discussion });
  } catch (error) {
    console.error('Error in forum discussion GET:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}