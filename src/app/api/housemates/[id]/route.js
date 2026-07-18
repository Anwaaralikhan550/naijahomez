export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import { normalizeImageFields } from '@/lib/hubFirestore';
import { fetchPublicListingById, isAppDbEnabled, upsertPublicListings } from '@/lib/db/listing-repository.cjs';

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

// New listings (created since the public_listings dedup) only exist in
// Postgres under collection_name='housemates' -- no Firestore-shim doc is
// written for them anymore. Older listings (including the legacy singular
// "housemate" collection) may still only exist in the shim.
async function loadListing(db, id) {
  if (isAppDbEnabled()) {
    const listing = await fetchPublicListingById('housemates', id);
    if (listing) return { source: 'postgres', collectionName: 'housemates', listing };
  }
  const { collectionName, doc } = await resolveHousemateDoc(db, id);
  if (doc?.exists) return { source: 'firestore', collectionName, listing: { id: doc.id, ...doc.data() } };
  return null;
}

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

    const found = await loadListing(db, id);
    if (!found) {
      return errorResponse('Housemate listing not found', 'HOUSEMATE_NOT_FOUND', 404);
    }

    const data = found.listing;
    return NextResponse.json({
      success: true,
      data: normalizeImageFields({
        ...data,
        id,
        collectionName: found.collectionName,
        slug: data.slug || id,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || null,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt || null
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
    const found = await loadListing(db, id);

    if (!found) {
      return errorResponse('Housemate listing not found', 'HOUSEMATE_NOT_FOUND', 404);
    }

    // Verify ownership
    const housemateData = found.listing;
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

    if (found.source === 'postgres') {
      const result = await upsertPublicListings('housemates', [{ id, ...housemateData, ...updates }]);
      if (!result?.upserted) {
        throw new Error('Failed to update housemate listing in database');
      }
    } else {
      await db.collection(found.collectionName).doc(id).update(updates);
      if (isAppDbEnabled()) {
        await upsertPublicListings('housemates', [{ id, ...housemateData, ...updates }]).catch((error) => {
          console.warn('Failed to update public listing mirror:', error?.message || error);
        });
      }
    }

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
    const found = await loadListing(db, id);

    if (!found) {
      return errorResponse('Housemate listing not found', 'HOUSEMATE_NOT_FOUND', 404);
    }

    // Verify ownership
    const housemateData = found.listing;
    if (housemateData.userId !== userId) {
      return errorResponse('Forbidden - You do not own this listing', 'FORBIDDEN', 403);
    }

    // Soft delete - update status instead of deleting
    const deletionUpdates = {
      status: 'deleted',
      deletedAt: new Date(),
      updatedAt: new Date()
    };

    if (found.source === 'postgres') {
      const result = await upsertPublicListings('housemates', [{ id, ...housemateData, ...deletionUpdates }]);
      if (!result?.upserted) {
        throw new Error('Failed to delete housemate listing in database');
      }
    } else {
      await db.collection(found.collectionName).doc(id).update(deletionUpdates);
      if (isAppDbEnabled()) {
        await upsertPublicListings('housemates', [{ id, ...housemateData, ...deletionUpdates }]).catch((error) => {
          console.warn('Failed to sync soft-delete to public listing mirror:', error?.message || error);
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Housemate listing deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting housemate listing:', error);
    return errorResponse('Failed to delete housemate listing', 'HOUSEMATE_DELETE_FAILED', 500);
  }
}
