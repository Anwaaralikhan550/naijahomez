export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
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
    // SECURITY: Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authFailureResponse(authResult.error);
    }

    // Initialize admin SDK
    const db = getAdminFirestore();

    const { searchParams } = new URL(request.url);
    const communityId = searchParams.get('communityId');
    const admin = searchParams.get('admin');
    const userId = searchParams.get('userId');
    const amenityId = searchParams.get('amenityId');

    if (!communityId) {
      return errorResponse('Community ID is required', 'VALIDATION_ERROR', 400);
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
      return errorResponse('Admin flag, User ID, or Amenity ID required', 'VALIDATION_ERROR', 400);
    }

    const querySnapshot = await query.get();
    const bookings = [];
    querySnapshot.forEach((doc) => {
      bookings.push({ id: doc.id, ...doc.data() });
    });

    return NextResponse.json({ bookings });
  } catch (error) {
    console.error('Error in amenity-bookings GET:', error);
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

    if (action === 'update_booking_status') {
      const { bookingId, status, adminId } = data;
      
      if (!bookingId || !status || !adminId) {
        return errorResponse('Booking ID, status, and admin ID are required', 'VALIDATION_ERROR', 400);
      }

      const validStatuses = ['pending', 'approved', 'rejected', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return errorResponse('Invalid booking status', 'VALIDATION_ERROR', 400);
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

    return errorResponse('Invalid action', 'VALIDATION_ERROR', 400);
  } catch (error) {
    console.error('Error in amenity-bookings POST:', error);
    return errorResponse(error.message, 'INTERNAL_ERROR', 500);
  }
}