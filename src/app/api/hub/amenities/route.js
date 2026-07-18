export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { 
  getAmenities,
  createAmenityBooking,
  updateDocument,
  deleteDocument,
  normalizeImageFields
} from '@/lib/hubFirestore';


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
    const communityId = searchParams.get('communityId');
    const action = searchParams.get('action');
    const amenityId = searchParams.get('amenityId');
    const userId = searchParams.get('userId');
    const admin = searchParams.get('admin');

    if (!communityId) {
      return errorResponse('Community ID is required', 'VALIDATION_ERROR', 400);
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
        return errorResponse('User ID or Amenity ID required for bookings', 'VALIDATION_ERROR', 400);
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
        amenities.push(normalizeImageFields({ id: doc.id, ...doc.data() }));
      });

      return NextResponse.json({ amenities });
    } else {
      // Default: get active amenities for users
      const amenities = await getAmenities(communityId);
      return NextResponse.json({ amenities });
    }
  } catch (error) {
    console.error('Error in amenities API:', error);
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
        return errorResponse('Community ID, name, and creator are required', 'VALIDATION_ERROR', 400);
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
        ...normalizeImageFields({ images: images || [] }),
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
        return errorResponse('Amenity ID is required', 'VALIDATION_ERROR', 400);
      }

      const updates = {
        ...normalizeImageFields(updateData),
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
        return errorResponse('Amenity ID is required', 'VALIDATION_ERROR', 400);
      }

      // Soft delete by marking as inactive
      await db.collection('hubAmenities').doc(amenityId).update({
        isActive: false,
        deletedAt: new Date()
      });

      return NextResponse.json({ success: true });
    }

    return errorResponse('Invalid action', 'VALIDATION_ERROR', 400);
  } catch (error) {
    console.error('Error in amenities POST:', error);
    return errorResponse(error.message, 'INTERNAL_ERROR', 500);
  }
}
