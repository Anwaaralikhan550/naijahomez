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
    const filter = searchParams.get('filter') || 'all';
    const postLimit = Math.min(parseInt(searchParams.get('limit')) || 20, 100);

    if (!communityId) {
      return NextResponse.json({ error: 'Community ID is required' }, { status: 400 });
    }

    // SECURITY: Verify community membership
    const isMember = await verifyCommunityMembership(db, authenticatedUserId, communityId);
    if (!isMember) {
      return NextResponse.json(
        { error: 'You are not a member of this community' },
        { status: 403 }
      );
    }

    let q;
    if (filter === 'all') {
      q = db.collection('socialPosts')
        .where('communityId', '==', communityId)
        .where('isActive', '==', true)
        .orderBy('createdAt', 'desc')
        .limit(postLimit);
    } else if (filter === 'trending') {
      q = db.collection('socialPosts')
        .where('communityId', '==', communityId)
        .where('isActive', '==', true)
        .orderBy('likeCount', 'desc')
        .limit(postLimit);
    } else {
      const typeMap = {
        'text': 'text',
        'announcements': 'announcement',
        'events': 'event',
        'marketplace': 'marketplace',
        'polls': 'poll'
      };

      const postType = typeMap[filter] || filter;
      q = db.collection('socialPosts')
        .where('communityId', '==', communityId)
        .where('type', '==', postType)
        .where('isActive', '==', true)
        .orderBy('createdAt', 'desc')
        .limit(postLimit);
    }

    const querySnapshot = await q.get();
    const posts = [];

    querySnapshot.forEach((postDoc) => {
      const data = postDoc.data();
      const postData = {
        id: postDoc.id,
        ...data,
        createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
        updatedAt: data.updatedAt ? data.updatedAt.toDate().toISOString() : null,
        eventDate: data.eventDate ? (data.eventDate.toDate ? data.eventDate.toDate().toISOString() : data.eventDate) : null,
        eventEndDate: data.eventEndDate ? (data.eventEndDate.toDate ? data.eventEndDate.toDate().toISOString() : data.eventEndDate) : null,
        comments: [],
        commentCount: data.commentCount || 0
      };
      posts.push(postData);
    });

    return NextResponse.json({ posts });
  } catch (error) {
    logger.error('Error in social feed GET', error);
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

    if (action === 'create_post') {
      const {
        communityId,
        content,
        type = 'text',
        tags = [],
        location,
        attachments = [],
        authorName,
        eventDate,
        eventTime,
        eventEndDate,
        eventEndTime,
        maxAttendees,
        requiresApproval,
        selectedAdId,
        selectedAdCollection,
        pollOptions,
        pollDuration
      } = data;

      if (!communityId || !content) {
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

      const postData = {
        communityId,
        content: content.trim(),
        type,
        tags,
        location: location?.trim() || '',
        attachments,
        authorId: authenticatedUserId, // SECURITY: Use authenticated user ID
        authorName,
        likes: [],
        likeCount: 0,
        commentCount: 0,
        shareCount: 0,
        viewCount: 0,
        isActive: true,
        isPinned: false,
        isModerated: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      if (type === 'event') {
        postData.eventDate = eventDate;
        postData.eventTime = eventTime;
        postData.eventEndDate = eventEndDate;
        postData.eventEndTime = eventEndTime;
        postData.maxAttendees = maxAttendees ? parseInt(maxAttendees) : null;
        postData.requiresApproval = requiresApproval || false;
        postData.rsvps = [];
      } else if (type === 'marketplace') {
        postData.adReference = {
          adId: selectedAdId,
          collection: selectedAdCollection
        };
      } else if (type === 'poll') {
        postData.pollOptions = pollOptions || [];
        postData.pollDuration = pollDuration || '7';
        postData.pollVotes = {};
        postData.pollStatus = 'active';
      }

      const docRef = await db.collection('socialPosts').add(postData);
      return NextResponse.json({ postId: docRef.id });
    }

    if (action === 'like_post') {
      const { postId } = data;

      if (!postId) {
        return NextResponse.json({ error: 'Post ID is required' }, { status: 400 });
      }

      const postRef = db.collection('socialPosts').doc(postId);
      const postSnap = await postRef.get();

      if (!postSnap.exists) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }

      const postData = postSnap.data();

      // SECURITY: Verify user is member of the community
      const isMember = await verifyCommunityMembership(db, authenticatedUserId, postData.communityId);
      if (!isMember) {
        return NextResponse.json(
          { error: 'You are not a member of this community' },
          { status: 403 }
        );
      }

      const likes = postData.likes || [];

      // Use authenticated user ID for likes
      if (likes.includes(authenticatedUserId)) {
        const updatedLikes = likes.filter(id => id !== authenticatedUserId);
        await postRef.update({
          likes: updatedLikes,
          likeCount: updatedLikes.length,
          updatedAt: new Date()
        });
      } else {
        const updatedLikes = [...likes, authenticatedUserId];
        await postRef.update({
          likes: updatedLikes,
          likeCount: updatedLikes.length,
          updatedAt: new Date()
        });
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'comment_on_post') {
      const { postId, content, authorName } = data;

      if (!postId || !content) {
        return NextResponse.json({ error: 'Required fields missing' }, { status: 400 });
      }

      const postSnap = await db.collection('socialPosts').doc(postId).get();
      if (!postSnap.exists) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }

      const postData = postSnap.data();

      // SECURITY: Verify user is member of the community
      const isMember = await verifyCommunityMembership(db, authenticatedUserId, postData.communityId);
      if (!isMember) {
        return NextResponse.json(
          { error: 'You are not a member of this community' },
          { status: 403 }
        );
      }

      const commentData = {
        postId,
        content: content.trim(),
        authorId: authenticatedUserId, // SECURITY: Use authenticated user ID
        authorName,
        likes: [],
        likeCount: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await db.collection('socialComments').add(commentData);

      const postRef = db.collection('socialPosts').doc(postId);
      const currentCommentCount = postData.commentCount || 0;
      await postRef.update({
        commentCount: currentCommentCount + 1,
        updatedAt: new Date()
      });

      return NextResponse.json({ success: true });
    }

    if (action === 'update_post') {
      const { postId, content, tags, location } = data;

      if (!postId) {
        return NextResponse.json({ error: 'Post ID is required' }, { status: 400 });
      }

      // SECURITY: Verify ownership before updating
      const postRef = db.collection('socialPosts').doc(postId);
      const postSnap = await postRef.get();

      if (!postSnap.exists) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }

      const postData = postSnap.data();
      if (postData.authorId !== authenticatedUserId) {
        return NextResponse.json(
          { error: 'You can only update your own posts' },
          { status: 403 }
        );
      }

      // Only allow updating safe fields
      const updateData = { updatedAt: new Date() };
      if (content !== undefined) updateData.content = content.trim();
      if (tags !== undefined) updateData.tags = tags;
      if (location !== undefined) updateData.location = location?.trim() || '';

      await postRef.update(updateData);
      return NextResponse.json({ success: true });
    }

    if (action === 'delete_post') {
      const { postId } = data;

      if (!postId) {
        return NextResponse.json({ error: 'Post ID is required' }, { status: 400 });
      }

      // SECURITY: Verify ownership before deleting
      const postRef = db.collection('socialPosts').doc(postId);
      const postSnap = await postRef.get();

      if (!postSnap.exists) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }

      const postData = postSnap.data();
      if (postData.authorId !== authenticatedUserId) {
        return NextResponse.json(
          { error: 'You can only delete your own posts' },
          { status: 403 }
        );
      }

      await postRef.update({
        isActive: false,
        deletedAt: new Date(),
        deletedBy: authenticatedUserId
      });

      return NextResponse.json({ success: true });
    }

    if (action === 'report_post') {
      const { postId, reason } = data;

      if (!postId || !reason) {
        return NextResponse.json({ error: 'Post ID and reason are required' }, { status: 400 });
      }

      const reportData = {
        postId,
        reportedBy: authenticatedUserId, // SECURITY: Use authenticated user ID
        reason,
        status: 'pending',
        createdAt: new Date()
      };

      await db.collection('postReports').add(reportData);
      return NextResponse.json({ success: true });
    }

    if (action === 'rsvp_event') {
      const { postId, status, userName } = data;

      if (!postId || !status || !userName) {
        return NextResponse.json({ error: 'Post ID, status, and user name are required' }, { status: 400 });
      }

      const postRef = db.collection('socialPosts').doc(postId);
      const postSnap = await postRef.get();

      if (!postSnap.exists) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }

      const postData = postSnap.data();

      // SECURITY: Verify user is member of the community
      const isMember = await verifyCommunityMembership(db, authenticatedUserId, postData.communityId);
      if (!isMember) {
        return NextResponse.json(
          { error: 'You are not a member of this community' },
          { status: 403 }
        );
      }

      if (postData.type !== 'event') {
        return NextResponse.json({ error: 'Can only RSVP to event posts' }, { status: 400 });
      }

      let rsvps = postData.rsvps || [];
      rsvps = rsvps.filter(rsvp => rsvp.userId !== authenticatedUserId);

      if (status !== 'not_going') {
        rsvps.push({
          userId: authenticatedUserId, // SECURITY: Use authenticated user ID
          userName,
          status,
          timestamp: new Date()
        });
      }

      await postRef.update({
        rsvps: rsvps,
        updatedAt: new Date()
      });

      return NextResponse.json({ success: true, rsvps });
    }

    if (action === 'share_post') {
      const { postId } = data;

      if (!postId) {
        return NextResponse.json({ error: 'Post ID is required' }, { status: 400 });
      }

      const postRef = db.collection('socialPosts').doc(postId);
      const postSnap = await postRef.get();

      if (!postSnap.exists) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }

      const postData = postSnap.data();
      const currentShareCount = postData.shareCount || 0;
      await postRef.update({
        shareCount: currentShareCount + 1,
        updatedAt: new Date()
      });

      return NextResponse.json({ success: true });
    }

    if (action === 'increment_view') {
      const { postId } = data;

      if (!postId) {
        return NextResponse.json({ error: 'Post ID is required' }, { status: 400 });
      }

      const postRef = db.collection('socialPosts').doc(postId);
      const postSnap = await postRef.get();

      if (!postSnap.exists) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }

      const postData = postSnap.data();
      const currentViewCount = postData.viewCount || 0;
      await postRef.update({
        viewCount: currentViewCount + 1
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    logger.error('Error in social feed POST', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
