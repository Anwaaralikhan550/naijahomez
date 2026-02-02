import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';

// GET - Fetch a single marketplace item
export async function GET(request, { params }) {
  try {
    const { id } = params;
    
    const db = getAdminFirestore();
    
    const docRef = db.collection('marketplace').doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Marketplace item not found' },
        { status: 404 }
      );
    }
    
    const data = doc.data();
    
    return NextResponse.json({
      success: true,
      data: {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate().toISOString(),
        updatedAt: data.updatedAt?.toDate().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error fetching marketplace item:', error);
    return NextResponse.json(
      { error: 'Failed to fetch marketplace item' },
      { status: 500 }
    );
  }
}

// PUT - Update a marketplace item (owner only)
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
    const docRef = db.collection('marketplace').doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Marketplace item not found' },
        { status: 404 }
      );
    }
    
    // Verify ownership
    const itemData = doc.data();
    if (itemData.userId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden - You do not own this item' },
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
      message: 'Marketplace item updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating marketplace item:', error);
    return NextResponse.json(
      { error: 'Failed to update marketplace item' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a marketplace item (owner only)
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
    const docRef = db.collection('marketplace').doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Marketplace item not found' },
        { status: 404 }
      );
    }
    
    // Verify ownership
    const itemData = doc.data();
    if (itemData.userId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden - You do not own this item' },
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
      message: 'Marketplace item deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting marketplace item:', error);
    return NextResponse.json(
      { error: 'Failed to delete marketplace item' },
      { status: 500 }
    );
  }
}