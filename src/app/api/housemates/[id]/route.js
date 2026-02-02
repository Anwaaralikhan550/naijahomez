import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';

// GET - Fetch a single housemate listing
export async function GET(request, { params }) {
  try {
    const { id } = params;
    
    const db = getAdminFirestore();
    
    const docRef = db.collection('housemates').doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Housemate listing not found' },
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
    console.error('Error fetching housemate listing:', error);
    return NextResponse.json(
      { error: 'Failed to fetch housemate listing' },
      { status: 500 }
    );
  }
}

// PUT - Update a housemate listing (owner only)
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
    const docRef = db.collection('housemates').doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Housemate listing not found' },
        { status: 404 }
      );
    }
    
    // Verify ownership
    const housemateData = doc.data();
    if (housemateData.userId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden - You do not own this listing' },
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
    
    // Update numeric budget if budget changed
    if (updateData.budget || updateData.budgetRange) {
      const budgetValue = updateData.budget || updateData.budgetRange;
      updates.budgetNumeric = parseFloat(String(budgetValue).replace(/[^0-9.]/g, '')) || 0;
    }
    
    await docRef.update(updates);
    
    return NextResponse.json({
      success: true,
      message: 'Housemate listing updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating housemate listing:', error);
    return NextResponse.json(
      { error: 'Failed to update housemate listing' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a housemate listing (owner only)
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
    const docRef = db.collection('housemates').doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Housemate listing not found' },
        { status: 404 }
      );
    }
    
    // Verify ownership
    const housemateData = doc.data();
    if (housemateData.userId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden - You do not own this listing' },
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
      message: 'Housemate listing deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting housemate listing:', error);
    return NextResponse.json(
      { error: 'Failed to delete housemate listing' },
      { status: 500 }
    );
  }
}