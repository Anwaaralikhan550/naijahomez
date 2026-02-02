import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth, isAdmin } from '@/lib/auth-middleware';

export async function GET(request) {
  try {
    // Initialize admin SDK
    const db = getAdminFirestore();

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const eventId = searchParams.get('eventId');
    const communityId = searchParams.get('communityId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
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

    if (action === 'rsvp_event') {
      const {
        eventId,
        userId,
        userName,
        status, // 'going', 'maybe', 'not_going'
        guestCount = 0
      } = data;

      if (!eventId || !userId || !status) {
        return NextResponse.json({ error: 'Event ID, user ID, and status are required' }, { status: 400 });
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
        return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
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
        return NextResponse.json({ error: 'Event ID and user ID are required' }, { status: 400 });
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

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in RSVP POST:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function updateEventCounts(eventId, oldStatus, newStatus) {
  const db = getFirestore();
  const updateData = {};

  // Decrement old status count
  if (oldStatus) {
    switch (oldStatus) {
      case 'going':
        updateData.goingCount = admin.firestore.FieldValue.increment(-1);
        updateData.attendeeCount = admin.firestore.FieldValue.increment(-1);
        break;
      case 'maybe':
        updateData.maybeCount = admin.firestore.FieldValue.increment(-1);
        break;
      case 'not_going':
        updateData.notGoingCount = admin.firestore.FieldValue.increment(-1);
        break;
    }
  }

  // Increment new status count
  if (newStatus) {
    switch (newStatus) {
      case 'going':
        updateData.goingCount = admin.firestore.FieldValue.increment(1);
        updateData.attendeeCount = admin.firestore.FieldValue.increment(1);
        break;
      case 'maybe':
        updateData.maybeCount = admin.firestore.FieldValue.increment(1);
        break;
      case 'not_going':
        updateData.notGoingCount = admin.firestore.FieldValue.increment(1);
        break;
    }
  }

  if (Object.keys(updateData).length > 0) {
    updateData.updatedAt = new Date();
    await db.collection('communityEvents').doc(eventId).update(updateData);
  }
}