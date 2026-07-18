export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuth } from 'firebase-admin/auth';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth, isAdmin } from '@/lib/auth-middleware';
import { normalizeImageFields } from '@/lib/hubFirestore';

// GET - Fetch a single noticeboard item
export async function GET(request, { params }) {
  try {
    const { id } = params;
    
    const db = getAdminFirestore();
    
    const docRef = db.collection('noticeboard').doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Noticeboard item not found' },
        { status: 404 }
      );
    }
    
    const data = doc.data();
    
    // Check if notice has expired
    if (data.expiresAt && new Date(data.expiresAt.toDate()) < new Date()) {
      return NextResponse.json(
        { error: 'Noticeboard item has expired' },
        { status: 410 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: normalizeImageFields({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate().toISOString(),
        updatedAt: data.updatedAt?.toDate().toISOString(),
        expiresAt: data.expiresAt?.toDate().toISOString()
      })
    });
    
  } catch (error) {
    console.error('Error fetching noticeboard item:', error);
    return NextResponse.json(
      { error: 'Failed to fetch noticeboard item' },
      { status: 500 }
    );
  }
}

// PUT - Update a noticeboard item (owner only)
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
    const docRef = db.collection('noticeboard').doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Noticeboard item not found' },
        { status: 404 }
      );
    }
    
    // Verify ownership
    const noticeData = doc.data();
    if (noticeData.userId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden - You do not own this notice' },
        { status: 403 }
      );
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
    
    // Update expiry date if provided
    if (updateData.expiresAt) {
      updates.expiresAt = new Date(updateData.expiresAt);
    }
    
    await docRef.update(updates);
    
    return NextResponse.json({
      success: true,
      message: 'Noticeboard item updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating noticeboard item:', error);
    return NextResponse.json(
      { error: 'Failed to update noticeboard item' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a noticeboard item (owner only)
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
    const docRef = db.collection('noticeboard').doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Noticeboard item not found' },
        { status: 404 }
      );
    }
    
    // Verify ownership
    const noticeData = doc.data();
    if (noticeData.userId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden - You do not own this notice' },
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
      message: 'Noticeboard item deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting noticeboard item:', error);
    return NextResponse.json(
      { error: 'Failed to delete noticeboard item' },
      { status: 500 }
    );
  }
}
