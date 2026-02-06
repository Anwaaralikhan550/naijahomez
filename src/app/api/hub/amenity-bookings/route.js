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
    const communityId = searchParams.get('communityId');
    const admin = searchParams.get('admin');
    const userId = searchParams.get('userId');
    const amenityId = searchParams.get('amenityId');

    if (!communityId) {
      return NextResponse.json({ error: 'Community ID is required' }, { status: 400 });
    }

    let query;
    if (admin === 'true') {
      // Admin view - get all bookings for the community
      query = db.collection('amenityBookings')
        .where('communityId', '==', communityId)
        .orderBy('createdAt', 'desc');
    } else if (userId) {
      // User view - get bookings for specific user
      query = db.collection('amenityBookings')
        .where('userId', '==', userId)
        .where('communityId', '==', communityId)
        .orderBy('bookingDate', 'desc');
    } else if (amenityId) {
      // Get bookings for specific amenity
      query = db.collection('amenityBookings')
        .where('amenityId', '==', amenityId)
        .orderBy('bookingDate', 'asc');
    } else {
      return NextResponse.json({ error: 'Admin flag, User ID, or Amenity ID required' }, { status: 400 });
    }

    const querySnapshot = await query.get();
    const bookings = [];
    querySnapshot.forEach((doc) => {
      bookings.push({ id: doc.id, ...doc.data() });
    });

    return NextResponse.json({ bookings });
  } catch (error) {
    console.error('Error in amenity-bookings GET:', error);
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

    if (action === 'update_booking_status') {
      const { bookingId, status, adminId } = data;
      
      if (!bookingId || !status || !adminId) {
        return NextResponse.json({ error: 'Booking ID, status, and admin ID are required' }, { status: 400 });
      }

      const validStatuses = ['pending', 'approved', 'rejected', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: 'Invalid booking status' }, { status: 400 });
      }

      const updateData = {
        status,
        lastModifiedBy: adminId,
        lastModifiedAt: new Date()
      };

      if (status === 'approved') {
        updateData.approvedAt = new Date();
        updateData.approvedBy = adminId;
      } else if (status === 'rejected') {
        updateData.rejectedAt = new Date();
        updateData.rejectedBy = adminId;
      }

      await db.collection('amenityBookings').doc(bookingId).update(updateData);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in amenity-bookings POST:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}