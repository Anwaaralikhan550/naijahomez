export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import {
  withApiSecurity,
  createErrorResponse,
  createSuccessResponse,
  sanitizeInput
} from '@/lib/api-validation-middleware';
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

async function handleGET(request) {
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
    const category = searchParams.get('category');
    const upcoming = searchParams.get('upcoming') === 'true';

    if (!communityId) {
      return createErrorResponse('Community ID is required', 400);
    }

    // SECURITY: Verify community membership
    const isMember = await verifyCommunityMembership(db, authenticatedUserId, communityId);
    if (!isMember) {
      return createErrorResponse('You are not a member of this community', 403);
    }

    let query = db.collection('communityEvents')
      .where('communityId', '==', communityId)
      .orderBy('startDate', 'asc');

    if (category && category !== 'all') {
      query = db.collection('communityEvents')
        .where('communityId', '==', communityId)
        .where('category', '==', category)
        .orderBy('startDate', 'asc');
    }

    const querySnapshot = await query.get();
    const events = [];

    querySnapshot.forEach((doc) => {
      const eventData = { id: doc.id, ...doc.data() };

      if (upcoming) {
        const eventDate = new Date(eventData.startDate);
        const now = new Date();
        if (eventDate > now) {
          events.push(eventData);
        }
      } else {
        events.push(eventData);
      }
    });

    return createSuccessResponse({ events });
  } catch (error) {
    logger.error('Error in events GET', error);
    return createErrorResponse(error.message, 500);
  }
}

async function handlePOST(request) {
  try {
    // SECURITY: Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const authenticatedUserId = authResult.userId;
    const db = getAdminFirestore();
    const body = request.parsedBody;
    const { action, ...data } = body;

    const sanitizedData = sanitizeInput(data);

    if (action === 'create_event') {
      const {
        communityId,
        title,
        description,
        category,
        startDate,
        endDate,
        startTime,
        endTime,
        location,
        maxAttendees,
        isPublic,
        requiresApproval,
        allowGuests,
        organizerName,
        tags
      } = sanitizedData;

      if (!communityId || !title || !startDate) {
        return createErrorResponse('Required fields missing', 400);
      }

      // SECURITY: Verify community membership
      const isMember = await verifyCommunityMembership(db, authenticatedUserId, communityId);
      if (!isMember) {
        return createErrorResponse('You are not a member of this community', 403);
      }

      const eventData = {
        communityId,
        title: title.trim(),
        description: description?.trim() || '',
        category: category || 'social',
        startDate,
        endDate: endDate || startDate,
        startTime: startTime || '',
        endTime: endTime || '',
        location: location?.trim() || '',
        maxAttendees: maxAttendees ? parseInt(maxAttendees) : null,
        isPublic: isPublic !== false,
        requiresApproval: requiresApproval || false,
        allowGuests: allowGuests !== false,
        organizerId: authenticatedUserId, // SECURITY: Use authenticated user ID
        organizerName,
        tags: tags || [],
        attendeeCount: 0,
        goingCount: 0,
        maybeCount: 0,
        notGoingCount: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const docRef = await db.collection('communityEvents').add(eventData);
      return createSuccessResponse({ eventId: docRef.id }, 'Event created successfully');
    }

    if (action === 'update_event') {
      const { eventId, title, description, category, startDate, endDate, startTime, endTime, location, maxAttendees, isPublic, requiresApproval, allowGuests, tags } = sanitizedData;

      if (!eventId) {
        return createErrorResponse('Event ID is required', 400);
      }

      // SECURITY: Verify ownership before updating
      const eventRef = db.collection('communityEvents').doc(eventId);
      const eventSnap = await eventRef.get();

      if (!eventSnap.exists()) {
        return createErrorResponse('Event not found', 404);
      }

      const eventData = eventSnap.data();
      if (eventData.organizerId !== authenticatedUserId) {
        return createErrorResponse('You can only update events you created', 403);
      }

      // Only allow updating safe fields
      const updateData = { updatedAt: new Date() };
      if (title !== undefined) updateData.title = title.trim();
      if (description !== undefined) updateData.description = description?.trim() || '';
      if (category !== undefined) updateData.category = category;
      if (startDate !== undefined) updateData.startDate = startDate;
      if (endDate !== undefined) updateData.endDate = endDate;
      if (startTime !== undefined) updateData.startTime = startTime;
      if (endTime !== undefined) updateData.endTime = endTime;
      if (location !== undefined) updateData.location = location?.trim() || '';
      if (maxAttendees !== undefined) updateData.maxAttendees = maxAttendees ? parseInt(maxAttendees) : null;
      if (isPublic !== undefined) updateData.isPublic = isPublic;
      if (requiresApproval !== undefined) updateData.requiresApproval = requiresApproval;
      if (allowGuests !== undefined) updateData.allowGuests = allowGuests;
      if (tags !== undefined) updateData.tags = tags;

      await eventRef.update(updateData);
      return createSuccessResponse({}, 'Event updated successfully');
    }

    if (action === 'delete_event') {
      const { eventId } = sanitizedData;

      if (!eventId) {
        return createErrorResponse('Event ID is required', 400);
      }

      // SECURITY: Verify ownership before deleting
      const eventRef = db.collection('communityEvents').doc(eventId);
      const eventSnap = await eventRef.get();

      if (!eventSnap.exists()) {
        return createErrorResponse('Event not found', 404);
      }

      const eventData = eventSnap.data();
      if (eventData.organizerId !== authenticatedUserId) {
        return createErrorResponse('You can only delete events you created', 403);
      }

      await eventRef.update({
        isActive: false,
        deletedAt: new Date(),
        deletedBy: authenticatedUserId
      });

      return createSuccessResponse({}, 'Event deleted successfully');
    }

    if (action === 'get_event_details') {
      const { eventId } = sanitizedData;

      if (!eventId) {
        return createErrorResponse('Event ID is required', 400);
      }

      const eventSnap = await db.collection('communityEvents').doc(eventId).get();

      if (!eventSnap.exists()) {
        return createErrorResponse('Event not found', 404);
      }

      const eventData = { id: eventSnap.id, ...eventSnap.data() };

      // SECURITY: Verify community membership
      const isMember = await verifyCommunityMembership(db, authenticatedUserId, eventData.communityId);
      if (!isMember) {
        return createErrorResponse('You are not a member of this community', 403);
      }

      const attendeesSnapshot = await db.collection('eventRsvps')
        .where('eventId', '==', eventId)
        .where('status', '==', 'going')
        .get();
      const attendees = [];
      attendeesSnapshot.forEach((doc) => {
        attendees.push({ id: doc.id, ...doc.data() });
      });

      eventData.attendees = attendees;
      return createSuccessResponse({ event: eventData });
    }

    return createErrorResponse('Invalid action', 400);
  } catch (error) {
    logger.error('Error in events POST', error);
    return createErrorResponse(error.message, 500);
  }
}

export const GET = withApiSecurity(handleGET, {
  rateLimitType: 'global'
});

export const POST = withApiSecurity(handlePOST, {
  rateLimitType: 'global',
  requiredFields: ['action'],
  validateBody: true
});
