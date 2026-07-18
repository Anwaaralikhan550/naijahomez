export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import { normalizeImageFields } from '@/lib/hubFirestore';

const errorResponse = (message, code, status = 500) =>
  NextResponse.json({ success: false, error: message, code }, { status });

const HOUSEMATE_COLLECTIONS = ['housemates', 'housemate'];

const resolveHousemateDoc = async (db, id) => {
  for (const collectionName of HOUSEMATE_COLLECTIONS) {
    const docRef = db.collection(collectionName).doc(id);
    const doc = await docRef.get();
    if (doc.exists) {
      return { collectionName, docRef, doc };
    }
  }

  return { collectionName: null, docRef: null, doc: null };
};

const authErrorResponse = async (authError) => {
  const status = authError?.status || 401;
  const payload = await authError?.clone?.().json?.().catch(() => ({}));
  const message = payload?.error || 'Authentication required';
  const code = status === 403 ? 'FORBIDDEN' : status === 503 ? 'AUTH_SERVICE_UNAVAILABLE' : 'UNAUTHORIZED';
  return errorResponse(message, code, status);
};

// GET - Fetch a single housemate listing
export async function GET(request, { params }) {
  try {
    const { id } = params;
    
    const db = getAdminFirestore();
    
    const { collectionName, doc } = await resolveHousemateDoc(db, id);
    
    if (!doc?.exists) {
      return errorResponse('Housemate listing not found', 'HOUSEMATE_NOT_FOUND', 404);
    }
    
    const data = doc.data();
    
    return NextResponse.json({
      success: true,
      data: normalizeImageFields({
        id: doc.id,
        collectionName,
        ...data,
        slug: data.slug || doc.id,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null
      })
    });
    
  } catch (error) {
    console.error('Error fetching housemate listing:', error);
    return errorResponse('Failed to fetch housemate listing', 'HOUSEMATE_FETCH_FAILED', 500);
  }
}

// PUT - Update a housemate listing (owner only)
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
    const { docRef, doc } = await resolveHousemateDoc(db, id);
    
    if (!doc?.exists) {
      return errorResponse('Housemate listing not found', 'HOUSEMATE_NOT_FOUND', 404);
    }
    
    // Verify ownership
    const housemateData = doc.data();
    if (housemateData.userId !== userId) {
      return errorResponse('Forbidden - You do not own this listing', 'FORBIDDEN', 403);
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
    return errorResponse('Failed to update housemate listing', 'HOUSEMATE_UPDATE_FAILED', 500);
  }
}

// DELETE - Delete a housemate listing (owner only)
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
    const { docRef, doc } = await resolveHousemateDoc(db, id);
    
    if (!doc?.exists) {
      return errorResponse('Housemate listing not found', 'HOUSEMATE_NOT_FOUND', 404);
    }
    
    // Verify ownership
    const housemateData = doc.data();
    if (housemateData.userId !== userId) {
      return errorResponse('Forbidden - You do not own this listing', 'FORBIDDEN', 403);
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
    return errorResponse('Failed to delete housemate listing', 'HOUSEMATE_DELETE_FAILED', 500);
  }
}
