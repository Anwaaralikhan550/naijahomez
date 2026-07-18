export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import { normalizeImageFields } from '@/lib/hubFirestore';

const errorResponse = (message, code, status = 500) =>
  NextResponse.json({ success: false, error: message, code }, { status });

const authErrorResponse = async (authError) => {
  const status = authError?.status || 401;
  const payload = await authError?.clone?.().json?.().catch(() => ({}));
  const message = payload?.error || 'Authentication required';
  const code = status === 403 ? 'FORBIDDEN' : status === 503 ? 'AUTH_SERVICE_UNAVAILABLE' : 'UNAUTHORIZED';
  return errorResponse(message, code, status);
};

// GET - Fetch a single marketplace item
export async function GET(request, { params }) {
  try {
    const { id } = params;
    
    const db = getAdminFirestore();
    
    const docRef = db.collection('marketplace').doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return errorResponse('Marketplace item not found', 'MARKETPLACE_ITEM_NOT_FOUND', 404);
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
    console.error('Error fetching marketplace item:', error);
    return errorResponse('Failed to fetch marketplace item', 'MARKETPLACE_FETCH_FAILED', 500);
  }
}

// PUT - Update a marketplace item (owner only)
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
    const docRef = db.collection('marketplace').doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return errorResponse('Marketplace item not found', 'MARKETPLACE_ITEM_NOT_FOUND', 404);
    }
    
    // Verify ownership
    const itemData = doc.data();
    if (itemData.userId !== userId) {
      return errorResponse('Forbidden - You do not own this item', 'FORBIDDEN', 403);
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
    if (updateData.price) {
      updates.priceNumeric = parseFloat(String(updateData.price).replace(/[^0-9.]/g, '')) || 0;
    }
    
    await docRef.update(updates);
    
    return NextResponse.json({
      success: true,
      message: 'Marketplace item updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating marketplace item:', error);
    return errorResponse('Failed to update marketplace item', 'MARKETPLACE_UPDATE_FAILED', 500);
  }
}

// DELETE - Delete a marketplace item (owner only)
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
    const docRef = db.collection('marketplace').doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return errorResponse('Marketplace item not found', 'MARKETPLACE_ITEM_NOT_FOUND', 404);
    }
    
    // Verify ownership
    const itemData = doc.data();
    if (itemData.userId !== userId) {
      return errorResponse('Forbidden - You do not own this item', 'FORBIDDEN', 403);
    }
    
    // Soft delete - update status instead of deleting
    await docRef.update({
      status: 'deleted',
      deletedAt: new Date(),
      updatedAt: new Date()
    });
    
    return NextResponse.json({
      success: true,
      message: 'Marketplace item deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting marketplace item:', error);
    return errorResponse('Failed to delete marketplace item', 'MARKETPLACE_DELETE_FAILED', 500);
  }
}
