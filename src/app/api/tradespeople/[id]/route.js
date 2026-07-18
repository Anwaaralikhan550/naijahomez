export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';

const errorResponse = (message, code, status = 500) =>
  NextResponse.json({ success: false, error: message, code }, { status });

const authErrorResponse = async (authError) => {
  const status = authError?.status || 401;
  const payload = await authError?.clone?.().json?.().catch(() => ({}));
  const message = payload?.error || 'Authentication required';
  const code = status === 403 ? 'FORBIDDEN' : status === 503 ? 'AUTH_SERVICE_UNAVAILABLE' : 'UNAUTHORIZED';
  return errorResponse(message, code, status);
};
import { normalizeImageFields } from '@/lib/hubFirestore';

// GET - Fetch a single service/tradesperson
export async function GET(request, { params }) {
  try {
    const { id } = params;
    
    const db = getAdminFirestore();
    
    const docRef = db.collection('services').doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return errorResponse('Service not found', 'SERVICE_NOT_FOUND', 404);
    }
    
    const data = doc.data();
    
    return NextResponse.json({
      success: true,
      data: normalizeImageFields({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate().toISOString(),
        updatedAt: data.updatedAt?.toDate().toISOString()
      })
    });
    
  } catch (error) {
    console.error('Error fetching service:', error);
    return errorResponse('Failed to fetch service', 'SERVICE_FETCH_FAILED', 500);
  }
}

// PUT - Update a service (owner only)
export async function PUT(request, { params }) {
  try {
    const { id } = params;
    
        // Verify authentication using the auth middleware
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authErrorResponse(authResult.error);
    }

    const userId = authResult.userId;

    const db = getAdminFirestore();
    const docRef = db.collection('services').doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return errorResponse('Service not found', 'SERVICE_NOT_FOUND', 404);
    }
    
    // Verify ownership
    const serviceData = doc.data();
    if (serviceData.userId !== userId) {
      return errorResponse('Forbidden - You do not own this service', 'FORBIDDEN', 403);
    }
    
    const updateData = await request.json();
    
    // Prepare update data
    const updates = {
      ...normalizeImageFields(updateData),
      updatedAt: new Date()
    };
    
    // Update lowercase fields if title or location changed
    if (updateData.title) {
      updates.titleLower = updateData.title.toLowerCase();
    }
    
    if (updateData.location) {
      updates.locationLower = updateData.location.toLowerCase();
    }
    
    // Update numeric price if price changed
    if (updateData.price || updateData.priceString) {
      const priceValue = updateData.price || updateData.priceString;
      updates.priceNumeric = parseFloat(String(priceValue).replace(/[^0-9.]/g, '')) || 0;
    }
    
    await docRef.update(updates);
    
    return NextResponse.json({
      success: true,
      message: 'Service updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating service:', error);
    return errorResponse('Failed to update service', 'SERVICE_UPDATE_FAILED', 500);
  }
}

// DELETE - Delete a service (owner only)
export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    
        // Verify authentication using the auth middleware
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authErrorResponse(authResult.error);
    }

    const userId = authResult.userId;

    const db = getAdminFirestore();
    const docRef = db.collection('services').doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return errorResponse('Service not found', 'SERVICE_NOT_FOUND', 404);
    }
    
    // Verify ownership
    const serviceData = doc.data();
    if (serviceData.userId !== userId) {
      return errorResponse('Forbidden - You do not own this service', 'FORBIDDEN', 403);
    }
    
    // Soft delete - update status instead of deleting
    await docRef.update({
      status: 'deleted',
      deletedAt: new Date(),
      updatedAt: new Date()
    });
    
    return NextResponse.json({
      success: true,
      message: 'Service deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting service:', error);
    return errorResponse('Failed to delete service', 'SERVICE_DELETE_FAILED', 500);
  }
}
