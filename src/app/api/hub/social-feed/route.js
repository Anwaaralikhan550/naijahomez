export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import logger from '@/lib/logger';

function errorResponse(message, code = 'INTERNAL_ERROR', status = 500) {
  return NextResponse.json({ success: false, error: message, code }, { status });
}

const MAX_POST_CONTENT_LENGTH = 3000;
const MAX_COMMENT_CONTENT_LENGTH = 1000;
const MAX_POST_LOCATION_LENGTH = 180;

function validateLength(field, value, maxLength) {
  if (typeof value !== 'string') return null;
  if (value.length <= maxLength) return null;

  return NextResponse.json(
    {
      success: false,
      code: 'VALIDATION_LENGTH_EXCEEDED',
      error: `Field '${field}' exceeds max length of ${maxLength} characters`,
      field,
      maxLength,
      actualLength: value.length
    },
    { status: 400 }
  );
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



// Helper function to verify community membership
async function verifyCommunityMembership(db, userId, communityId) {
  const activeFlagQuery = await db.collection('hubMembers')
    .where('userId', '==', userId)
    .where('communityId', '==', communityId)
    .where('isActive', '==', true)
    .limit(1)
    .get();

  if (!activeFlagQuery.empty) {
    return true;
  }

  // Backward compatibility: older membership records use `status: active`
  const activeStatusQuery = await db.collection('hubMembers')
    .where('userId', '==', userId)
    .where('communityId', '==', communityId)
    .where('status', '==', 'active')
    .limit(1)
    .get();

  return !activeStatusQuery.empty;
}

export async function GET(request) {
  try {
    // SECURITY: Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authFailureResponse(authResult.error);
    }

    const authenticatedUserId = authResult.userId;
    const db = getAdminFirestore();

    const { searchParams } = new URL(request.url);
    const communityId = searchParams.get('communityId');
    const filter = searchParams.get('filter') || 'all';
    const postLimit = Math.min(parseInt(searchParams.get('limit')) || 20, 100);

    if (!communityId) {
      return errorResponse('Community ID is required', 'VALIDATION_ERROR', 400);
    }

    // SECURITY: Verify community membership
    const isMember = await verifyCommunityMembership(db, authenticatedUserId, communityId);
    if (!isMember) {
      return errorResponse('You are not a member of this community', 'FORBIDDEN', 403);
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
    return errorResponse(error.message, 'INTERNAL_ERROR', 500);
  }
}

export async function POST(request) {
  try {
    // SECURITY: Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authFailureResponse(authResult.error);
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
        return errorResponse('Required fields missing', 'VALIDATION_ERROR', 400);
      }

      const trimmedContent = String(content).trim();
      const contentLengthError = validateLength('content', trimmedContent, MAX_POST_CONTENT_LENGTH);
      if (contentLengthError) {
        return contentLengthError;
      }

      const trimmedLocation = String(location || '').trim();
      const locationLengthError = validateLength('location', trimmedLocation, MAX_POST_LOCATION_LENGTH);
      if (locationLengthError) {
        return locationLengthError;
      }

      // SECURITY: Verify community membership
      const isMember = await verifyCommunityMembership(db, authenticatedUserId, communityId);
      if (!isMember) {
        return errorResponse('You are not a member of this community', 'FORBIDDEN', 403);
      }

      const postData = {
        communityId,
        content: trimmedContent,
        type,
        tags,
        location: trimmedLocation,
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
        const normalizedEventDate = typeof eventDate === 'string' ? eventDate.trim() : eventDate;
        const normalizedEventTime = typeof eventTime === 'string' ? eventTime.trim() : eventTime;
        const normalizedEventEndDate = typeof eventEndDate === 'string' ? eventEndDate.trim() : eventEndDate;
        const normalizedEventEndTime = typeof eventEndTime === 'string' ? eventEndTime.trim() : eventEndTime;

        postData.eventDate = normalizedEventDate || null;
        postData.eventTime = normalizedEventTime || null;
        postData.eventEndDate = normalizedEventEndDate || null;
        postData.eventEndTime = normalizedEventEndTime || null;
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
        return errorResponse('Post ID is required', 'VALIDATION_ERROR', 400);
      }

      const postRef = db.collection('socialPosts').doc(postId);
      const postSnap = await postRef.get();

      if (!postSnap.exists) {
        return errorResponse('Post not found', 'NOT_FOUND', 404);
      }

      const postData = postSnap.data();

      // SECURITY: Verify user is member of the community
      const isMember = await verifyCommunityMembership(db, authenticatedUserId, postData.communityId);
      if (!isMember) {
        return errorResponse('You are not a member of this community', 'FORBIDDEN', 403);
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
        return errorResponse('Required fields missing', 'VALIDATION_ERROR', 400);
      }

      const trimmedContent = String(content).trim();
      const commentLengthError = validateLength('content', trimmedContent, MAX_COMMENT_CONTENT_LENGTH);
      if (commentLengthError) {
        return commentLengthError;
      }

      const postSnap = await db.collection('socialPosts').doc(postId).get();
      if (!postSnap.exists) {
        return errorResponse('Post not found', 'NOT_FOUND', 404);
      }

      const postData = postSnap.data();

      // SECURITY: Verify user is member of the community
      const isMember = await verifyCommunityMembership(db, authenticatedUserId, postData.communityId);
      if (!isMember) {
        return errorResponse('You are not a member of this community', 'FORBIDDEN', 403);
      }

      const commentData = {
        postId,
        content: trimmedContent,
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
        return errorResponse('Post ID is required', 'VALIDATION_ERROR', 400);
      }

      // SECURITY: Verify ownership before updating
      const postRef = db.collection('socialPosts').doc(postId);
      const postSnap = await postRef.get();

      if (!postSnap.exists) {
        return errorResponse('Post not found', 'NOT_FOUND', 404);
      }

      const postData = postSnap.data();
      if (postData.authorId !== authenticatedUserId) {
        return errorResponse('You can only update your own posts', 'FORBIDDEN', 403);
      }

      // Only allow updating safe fields
      const updateData = { updatedAt: new Date() };
      if (content !== undefined) {
        const trimmedContent = String(content).trim();
        const contentLengthError = validateLength('content', trimmedContent, MAX_POST_CONTENT_LENGTH);
        if (contentLengthError) {
          return contentLengthError;
        }
        updateData.content = trimmedContent;
      }
      if (tags !== undefined) updateData.tags = tags;
      if (location !== undefined) {
        const trimmedLocation = String(location || '').trim();
        const locationLengthError = validateLength('location', trimmedLocation, MAX_POST_LOCATION_LENGTH);
        if (locationLengthError) {
          return locationLengthError;
        }
        updateData.location = trimmedLocation;
      }

      await postRef.update(updateData);
      return NextResponse.json({ success: true });
    }

    if (action === 'update_comment') {
      const { commentId, content } = data;

      if (!commentId || !content) {
        return errorResponse('Comment ID and content are required', 'VALIDATION_ERROR', 400);
      }

      const commentRef = db.collection('socialComments').doc(commentId);
      const commentSnap = await commentRef.get();

      if (!commentSnap.exists) {
        return errorResponse('Comment not found', 'NOT_FOUND', 404);
      }

      const commentData = commentSnap.data();
      if (commentData.authorId !== authenticatedUserId) {
        return errorResponse('You can only edit your own comments', 'FORBIDDEN', 403);
      }

      const trimmedContent = String(content).trim();
      const commentLengthError = validateLength('content', trimmedContent, MAX_COMMENT_CONTENT_LENGTH);
      if (commentLengthError) {
        return commentLengthError;
      }

      await commentRef.update({
        content: trimmedContent,
        updatedAt: new Date(),
        editedAt: new Date()
      });

      return NextResponse.json({ success: true });
    }

    if (action === 'delete_comment') {
      const { commentId } = data;

      if (!commentId) {
        return errorResponse('Comment ID is required', 'VALIDATION_ERROR', 400);
      }

      const commentRef = db.collection('socialComments').doc(commentId);
      const commentSnap = await commentRef.get();

      if (!commentSnap.exists) {
        return errorResponse('Comment not found', 'NOT_FOUND', 404);
      }

      const commentData = commentSnap.data();
      if (commentData.authorId !== authenticatedUserId) {
        return errorResponse('You can only delete your own comments', 'FORBIDDEN', 403);
      }

      await commentRef.update({
        isActive: false,
        deletedAt: new Date(),
        deletedBy: authenticatedUserId,
        updatedAt: new Date()
      });

      const postRef = db.collection('socialPosts').doc(commentData.postId);
      const postSnap = await postRef.get();
      if (postSnap.exists) {
        const postData = postSnap.data();
        const currentCommentCount = postData.commentCount || 0;
        await postRef.update({
          commentCount: Math.max(currentCommentCount - 1, 0),
          updatedAt: new Date()
        });
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'delete_post') {
      const { postId } = data;

      if (!postId) {
        return errorResponse('Post ID is required', 'VALIDATION_ERROR', 400);
      }

      // SECURITY: Verify ownership before deleting
      const postRef = db.collection('socialPosts').doc(postId);
      const postSnap = await postRef.get();

      if (!postSnap.exists) {
        return errorResponse('Post not found', 'NOT_FOUND', 404);
      }

      const postData = postSnap.data();
      if (postData.authorId !== authenticatedUserId) {
        return errorResponse('You can only delete your own posts', 'FORBIDDEN', 403);
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
        return errorResponse('Post ID and reason are required', 'VALIDATION_ERROR', 400);
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
        return errorResponse('Post ID, status, and user name are required', 'VALIDATION_ERROR', 400);
      }

      const postRef = db.collection('socialPosts').doc(postId);
      const postSnap = await postRef.get();

      if (!postSnap.exists) {
        return errorResponse('Post not found', 'NOT_FOUND', 404);
      }

      const postData = postSnap.data();

      // SECURITY: Verify user is member of the community
      const isMember = await verifyCommunityMembership(db, authenticatedUserId, postData.communityId);
      if (!isMember) {
        return errorResponse('You are not a member of this community', 'FORBIDDEN', 403);
      }

      if (postData.type !== 'event') {
        return errorResponse('Can only RSVP to event posts', 'VALIDATION_ERROR', 400);
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
        return errorResponse('Post ID is required', 'VALIDATION_ERROR', 400);
      }

      const postRef = db.collection('socialPosts').doc(postId);
      const postSnap = await postRef.get();

      if (!postSnap.exists) {
        return errorResponse('Post not found', 'NOT_FOUND', 404);
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
        return errorResponse('Post ID is required', 'VALIDATION_ERROR', 400);
      }

      const postRef = db.collection('socialPosts').doc(postId);
      const postSnap = await postRef.get();

      if (!postSnap.exists) {
        return errorResponse('Post not found', 'NOT_FOUND', 404);
      }

      const postData = postSnap.data();
      const currentViewCount = postData.viewCount || 0;
      await postRef.update({
        viewCount: currentViewCount + 1
      });

      return NextResponse.json({ success: true });
    }

    return errorResponse('Invalid action', 'VALIDATION_ERROR', 400);
  } catch (error) {
    logger.error('Error in social feed POST', error);
    return errorResponse(error.message, 'INTERNAL_ERROR', 500);
  }
}
