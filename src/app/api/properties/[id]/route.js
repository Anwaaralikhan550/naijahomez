export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuth } from 'firebase-admin/auth';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth, isAdmin } from '@/lib/auth-middleware';
import { fixListingEncoding } from '@/utils/fixEncoding';
import { normalizeImageFields } from '@/lib/hubFirestore';
import { deletePublicListing, upsertPublicListings } from '@/lib/db/listing-repository.cjs';

const errorResponse = (message, code, status = 500) =>
  NextResponse.json({ success: false, error: message, code }, { status });

const authErrorResponse = async (authError) => {
  const status = authError?.status || 401;
  const payload = await authError?.clone?.().json?.().catch(() => ({}));
  const message = payload?.error || 'Authentication required';
  const code = status === 403 ? 'FORBIDDEN' : status === 503 ? 'AUTH_SERVICE_UNAVAILABLE' : 'UNAUTHORIZED';
  return errorResponse(message, code, status);
};

// GET - Fetch a single property
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    
    const db = getAdminFirestore();
    
    const docRef = db.collection('properties').doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return errorResponse('Property not found', 'PROPERTY_NOT_FOUND', 404);
    }
    
    const data = doc.data();
    
    return NextResponse.json({
      success: true,
      data: fixListingEncoding(normalizeImageFields({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate().toISOString(),
        updatedAt: data.updatedAt?.toDate().toISOString()
      }))
    });
    
  } catch (error) {
    console.error('Error fetching property:', error);
    return errorResponse('Failed to fetch property', 'PROPERTY_FETCH_FAILED', 500);
  }
}

// PUT - Update a property (owner only)
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    
        // Verify authentication using the auth middleware
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authErrorResponse(authResult.error);
    }

    const userId = authResult.userId;

    const db = getAdminFirestore();
    const docRef = db.collection('properties').doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return errorResponse('Property not found', 'PROPERTY_NOT_FOUND', 404);
    }
    
    // Verify ownership
    const propertyData = doc.data();
    if (propertyData.userId !== userId) {
      return errorResponse('Forbidden - You do not own this property', 'FORBIDDEN', 403);
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
    await upsertPublicListings('properties', [{
      id,
      ...propertyData,
      ...updates
    }]).catch((error) => {
      console.warn('Failed to update public listing mirror:', error?.message || error);
    });
    
    return NextResponse.json({
      success: true,
      message: 'Property updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating property:', error);
    return errorResponse('Failed to update property', 'PROPERTY_UPDATE_FAILED', 500);
  }
}

// DELETE - Delete a property (owner only)
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    
        // Verify authentication using the auth middleware
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authErrorResponse(authResult.error);
    }

    const userId = authResult.userId;

    const db = getAdminFirestore();
    const docRef = db.collection('properties').doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return errorResponse('Property not found', 'PROPERTY_NOT_FOUND', 404);
    }
    
    // Verify ownership
    const propertyData = doc.data();
    if (propertyData.userId !== userId) {
      return errorResponse('Forbidden - You do not own this property', 'FORBIDDEN', 403);
    }
    
    // Soft delete - update status instead of deleting
    await docRef.update({
      status: 'deleted',
      deletedAt: new Date(),
      updatedAt: new Date()
    });
    await deletePublicListing('properties', id).catch((error) => {
      console.warn('Failed to delete public listing mirror:', error?.message || error);
    });
    
    return NextResponse.json({
      success: true,
      message: 'Property deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting property:', error);
    return errorResponse('Failed to delete property', 'PROPERTY_DELETE_FAILED', 500);
  }
}
