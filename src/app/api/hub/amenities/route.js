import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { 
  getAmenities,
  createAmenityBooking,
  updateDocument,
  deleteDocument 
} from '@/lib/hubFirestore';


import { verifyAuth, isAdmin } from '@/lib/auth-middleware';

export async function GET(request) {
  try {
    // Initialize admin SDK
    const db = getAdminFirestore();

    const { searchParams } = new URL(request.url);
    const communityId = searchParams.get('communityId');
    const action = searchParams.get('action');
    const amenityId = searchParams.get('amenityId');
    const userId = searchParams.get('userId');
    const admin = searchParams.get('admin');

    if (!communityId) {
      return NextResponse.json({ error: 'Community ID is required' }, { status: 400 });
    }

    if (action === 'bookings') {
      // Get bookings for user or amenity
      let query;
      if (userId) {
        query = db.collection('hubAmenityBookings')
          .where('userId', '==', userId)
          .where('communityId', '==', communityId)
          .orderBy('bookingDate', 'desc');
      } else if (amenityId) {
        query = db.collection('hubAmenityBookings')
          .where('amenityId', '==', amenityId)
          .orderBy('bookingDate', 'asc');
      } else {
        return NextResponse.json({ error: 'User ID or Amenity ID required for bookings' }, { status: 400 });
      }

      const querySnapshot = await query.get();
      const bookings = [];
      querySnapshot.forEach((doc) => {
        bookings.push({ id: doc.id, ...doc.data() });
      });

      return NextResponse.json({ bookings });
    }

    // Get amenities
    if (admin === 'true') {
      // Admin view - get all amenities including inactive
      const querySnapshot = await db.collection('hubAmenities')
        .where('communityId', '==', communityId)
        .orderBy('createdAt', 'desc')
        .get();
      const amenities = [];
      querySnapshot.forEach((doc) => {
        amenities.push({ id: doc.id, ...doc.data() });
      });

      return NextResponse.json({ amenities });
    } else {
      // Default: get active amenities for users
      const amenities = await getAmenities(communityId);
      return NextResponse.json({ amenities });
    }
  } catch (error) {
    console.error('Error in amenities API:', error);
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

    if (action === 'create_booking') {
      const bookingData = {
        ...data,
        status: 'confirmed',
        createdBy: userId,
        createdAt: new Date()
      };
      const bookingId = await createAmenityBooking(bookingData);
      return NextResponse.json({ success: true, bookingId });
    }

    if (action === 'cancel_booking') {
      const { bookingId } = data;
      await updateDocument('hubAmenityBookings', bookingId, { 
        status: 'cancelled',
        cancelledAt: new Date() 
      });
      return NextResponse.json({ success: true });
    }

    // Admin actions for amenity management
    if (action === 'create_amenity') {
      const {
        communityId,
        name,
        description,
        location,
        capacity,
        rules,
        availableHours,
        bookingAdvanceDays,
        maxBookingHours,
        requiresApproval,
        isActive,
        fee,
        images,
        createdBy,
        createdByName
      } = data;

      if (!communityId || !name || !createdBy) {
        return NextResponse.json({ error: 'Community ID, name, and creator are required' }, { status: 400 });
      }

      const amenityData = {
        communityId,
        name: name.trim(),
        description: description?.trim() || '',
        location: location?.trim() || '',
        capacity: capacity || null,
        rules: rules?.trim() || '',
        availableHours: availableHours || { start: '08:00', end: '22:00' },
        bookingAdvanceDays: bookingAdvanceDays || 7,
        maxBookingHours: maxBookingHours || 4,
        requiresApproval: requiresApproval || false,
        isActive: isActive !== false,
        fee: fee || 0,
        images: images || [],
        createdBy,
        createdByName,
        createdAt: new Date(),
        lastModifiedAt: new Date()
      };

      const docRef = await db.collection('hubAmenities').add(amenityData);
      return NextResponse.json({ amenityId: docRef.id });
    }

    if (action === 'update_amenity') {
      const { amenityId, ...updateData } = data;
      
      if (!amenityId) {
        return NextResponse.json({ error: 'Amenity ID is required' }, { status: 400 });
      }

      const updates = {
        ...updateData,
        lastModifiedAt: new Date()
      };
      
      // Remove undefined fields
      Object.keys(updates).forEach(key => {
        if (updates[key] === undefined) {
          delete updates[key];
        }
      });

      await db.collection('hubAmenities').doc(amenityId).update(updates);
      return NextResponse.json({ success: true });
    }

    if (action === 'delete_amenity') {
      const { amenityId } = data;
      
      if (!amenityId) {
        return NextResponse.json({ error: 'Amenity ID is required' }, { status: 400 });
      }

      // Soft delete by marking as inactive
      await db.collection('hubAmenities').doc(amenityId).update({
        isActive: false,
        deletedAt: new Date()
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in amenities POST:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}