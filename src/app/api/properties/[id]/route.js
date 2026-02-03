import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuth } from 'firebase-admin/auth';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth, isAdmin } from '@/lib/auth-middleware';
import { fixListingEncoding } from '@/utils/fixEncoding';

// GET - Fetch a single property
export async function GET(request, { params }) {
  try {
    const { id } = params;
    
    const db = getAdminFirestore();
    
    const docRef = db.collection('properties').doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      );
    }
    
    const data = doc.data();
    
    return NextResponse.json({
      success: true,
      data: fixListingEncoding({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate().toISOString(),
        updatedAt: data.updatedAt?.toDate().toISOString()
      })
    });
    
  } catch (error) {
    console.error('Error fetching property:', error);
    return NextResponse.json(
      { error: 'Failed to fetch property' },
      { status: 500 }
    );
  }
}

// PUT - Update a property (owner only)
export async function PUT(request, { params }) {
  try {
    const { id } = params;
    
        // Verify authentication using the auth middleware
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const userId = authResult.userId;

    const db = getAdminFirestore();
    const docRef = db.collection('properties').doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      );
    }
    
    // Verify ownership
    const propertyData = doc.data();
    if (propertyData.userId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden - You do not own this property' },
        { status: 403 }
      );
    }
    
    const updateData = await request.json();
    
    // Prepare update data
    const updates = {
      ...updateData,
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
      message: 'Property updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating property:', error);
    return NextResponse.json(
      { error: 'Failed to update property' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a property (owner only)
export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    
        // Verify authentication using the auth middleware
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const userId = authResult.userId;

    const db = getAdminFirestore();
    const docRef = db.collection('properties').doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      );
    }
    
    // Verify ownership
    const propertyData = doc.data();
    if (propertyData.userId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden - You do not own this property' },
        { status: 403 }
      );
    }
    
    // Soft delete - update status instead of deleting
    await docRef.update({
      status: 'deleted',
      deletedAt: new Date(),
      updatedAt: new Date()
    });
    
    return NextResponse.json({
      success: true,
      message: 'Property deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting property:', error);
    return NextResponse.json(
      { error: 'Failed to delete property' },
      { status: 500 }
    );
  }
}