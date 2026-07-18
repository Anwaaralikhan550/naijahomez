export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
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
    // Initialize admin SDK
    const db = getAdminFirestore();

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const eventId = searchParams.get('eventId');
    const communityId = searchParams.get('communityId');

    if (!userId) {
      return errorResponse('User ID is required', 'VALIDATION_ERROR', 400);
    }

    let query;
    if (eventId) {
      // Get specific RSVP
      query = db.collection('eventRsvps')
        .where('userId', '==', userId)
        .where('eventId', '==', eventId);
    } else if (communityId) {
      // Get all RSVPs for user in community
      query = db.collection('eventRsvps')
        .where('userId', '==', userId)
        .where('communityId', '==', communityId);
    } else {
      // Get all RSVPs for user
      query = db.collection('eventRsvps')
        .where('userId', '==', userId);
    }

    const querySnapshot = await query.get();
    const rsvps = [];
    
    querySnapshot.forEach((doc) => {
      rsvps.push({ id: doc.id, ...doc.data() });
    });

    return NextResponse.json({ rsvps });
  } catch (error) {
    console.error('Error in RSVP GET:', error);
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

    const authenticatedUserId = authResult.userId;
    const body = await request.json();
    const { action, ...data } = body;

    if (action === 'rsvp_event') {
      const {
        eventId,
        userId,
        userName,
        status, // 'going', 'maybe', 'not_going'
        guestCount = 0
      } = data;

      if (!eventId || !userId || !status) {
        return errorResponse('Event ID, user ID, and status are required', 'VALIDATION_ERROR', 400);
      }

      if (userId !== authenticatedUserId) {
        return errorResponse('You can only RSVP as the authenticated user', 'FORBIDDEN', 403);
      }

      // Check if RSVP already exists
      const existingRsvpSnapshot = await db.collection('eventRsvps')
        .where('eventId', '==', eventId)
        .where('userId', '==', userId)
        .get();
      
      if (!existingRsvpSnapshot.empty) {
        // Update existing RSVP
        const rsvpDoc = existingRsvpSnapshot.docs[0];
        const oldData = rsvpDoc.data();
        
        await db.collection('eventRsvps').doc(rsvpDoc.id).update({
          status,
          guestCount,
          updatedAt: new Date()
        });

        // Update event counts
        await updateEventCounts(eventId, oldData.status, status);
      } else {
        // Create new RSVP
        const rsvpData = {
          eventId,
          userId,
          userName,
          status,
          guestCount,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await db.collection('eventRsvps').add(rsvpData);
        
        // Update event counts
        await updateEventCounts(eventId, null, status);
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'get_event_attendees') {
      const { eventId, status } = data;
      
      if (!eventId) {
        return errorResponse('Event ID is required', 'VALIDATION_ERROR', 400);
      }

      let query = db.collection('eventRsvps')
        .where('eventId', '==', eventId);

      if (status) {
        query = db.collection('eventRsvps')
          .where('eventId', '==', eventId)
          .where('status', '==', status);
      }

      const querySnapshot = await query.get();
      const attendees = [];
      
      querySnapshot.forEach((doc) => {
        attendees.push({ id: doc.id, ...doc.data() });
      });

      return NextResponse.json({ attendees });
    }

    if (action === 'remove_rsvp') {
      const { eventId, userId } = data;
      
      if (!eventId || !userId) {
        return errorResponse('Event ID and user ID are required', 'VALIDATION_ERROR', 400);
      }

      const rsvpSnapshot = await db.collection('eventRsvps')
        .where('eventId', '==', eventId)
        .where('userId', '==', userId)
        .get();
      
      if (!rsvpSnapshot.empty) {
        const rsvpDoc = rsvpSnapshot.docs[0];
        const rsvpData = rsvpDoc.data();
        
        await db.collection('eventRsvps').doc(rsvpDoc.id).delete();
        
        // Update event counts
        await updateEventCounts(eventId, rsvpData.status, null);
      }

      return NextResponse.json({ success: true });
    }

    return errorResponse('Invalid action', 'VALIDATION_ERROR', 400);
  } catch (error) {
    console.error('Error in RSVP POST:', error);
    return errorResponse(error.message, 'INTERNAL_ERROR', 500);
  }
}

async function updateEventCounts(eventId, oldStatus, newStatus) {
  const db = getAdminFirestore();
  const updateData = {};

  // Decrement old status count
  if (oldStatus) {
    switch (oldStatus) {
      case 'going':
        updateData.goingCount = FieldValue.increment(-1);
        updateData.attendeeCount = FieldValue.increment(-1);
        break;
      case 'maybe':
        updateData.maybeCount = FieldValue.increment(-1);
        break;
      case 'not_going':
        updateData.notGoingCount = FieldValue.increment(-1);
        break;
    }
  }

  // Increment new status count
  if (newStatus) {
    switch (newStatus) {
      case 'going':
        updateData.goingCount = FieldValue.increment(1);
        updateData.attendeeCount = FieldValue.increment(1);
        break;
      case 'maybe':
        updateData.maybeCount = FieldValue.increment(1);
        break;
      case 'not_going':
        updateData.notGoingCount = FieldValue.increment(1);
        break;
    }
  }

  if (Object.keys(updateData).length > 0) {
    updateData.updatedAt = new Date();
    await db.collection('communityEvents').doc(eventId).update(updateData);
  }
}
