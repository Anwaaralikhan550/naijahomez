export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuth } from 'firebase-admin/auth';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth, isAdmin } from '@/lib/auth-middleware';
import { fixListingEncoding } from '@/utils/fixEncoding';
import { normalizeImageFields } from '@/lib/hubFirestore';
import { fetchPublicListingById, isAppDbEnabled, upsertPublicListings } from '@/lib/db/listing-repository.cjs';

const errorResponse = (message, code, status = 500) =>
  NextResponse.json({ success: false, error: message, code }, { status });

const authErrorResponse = async (authError) => {
  const status = authError?.status || 401;
  const payload = await authError?.clone?.().json?.().catch(() => ({}));
  const message = payload?.error || 'Authentication required';
  const code = status === 403 ? 'FORBIDDEN' : status === 503 ? 'AUTH_SERVICE_UNAVAILABLE' : 'UNAUTHORIZED';
  return errorResponse(message, code, status);
};

// New listings (created since the public_listings dedup) only exist in
// Postgres -- no Firestore-shim doc is written for them anymore. Older
// listings, or ones whose Postgres sync failed at creation time, may still
// only exist in the shim. Try Postgres first, fall back to the shim.
async function loadListing(db, id) {
  if (isAppDbEnabled()) {
    const listing = await fetchPublicListingById('properties', id);
    if (listing) return { source: 'postgres', listing };
  }
  const doc = await db.collection('properties').doc(id).get();
  if (doc.exists) return { source: 'firestore', listing: { id: doc.id, ...doc.data() } };
  return null;
}

// GET - Fetch a single property
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const db = getAdminFirestore();

    const found = await loadListing(db, id);
    if (!found) {
      return errorResponse('Property not found', 'PROPERTY_NOT_FOUND', 404);
    }

    const data = found.listing;
    return NextResponse.json({
      success: true,
      data: fixListingEncoding(normalizeImageFields({
        ...data,
        id,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt
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
    const found = await loadListing(db, id);

    if (!found) {
      return errorResponse('Property not found', 'PROPERTY_NOT_FOUND', 404);
    }

    // Verify ownership
    const propertyData = found.listing;
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

    if (found.source === 'postgres') {
      const result = await upsertPublicListings('properties', [{ id, ...propertyData, ...updates }]);
      if (!result?.upserted) {
        throw new Error('Failed to update property in database');
      }
    } else {
      await db.collection('properties').doc(id).update(updates);
      if (isAppDbEnabled()) {
        await upsertPublicListings('properties', [{ id, ...propertyData, ...updates }]).catch((error) => {
          console.warn('Failed to update public listing mirror:', error?.message || error);
        });
      }
    }

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
    const found = await loadListing(db, id);

    if (!found) {
      return errorResponse('Property not found', 'PROPERTY_NOT_FOUND', 404);
    }

    // Verify ownership
    const propertyData = found.listing;
    if (propertyData.userId !== userId) {
      return errorResponse('Forbidden - You do not own this property', 'FORBIDDEN', 403);
    }

    // Soft delete - update status instead of deleting (status='deleted' is
    // already excluded from every public read path in listing-repository.cjs)
    const deletionUpdates = {
      status: 'deleted',
      deletedAt: new Date(),
      updatedAt: new Date()
    };

    if (found.source === 'postgres') {
      const result = await upsertPublicListings('properties', [{ id, ...propertyData, ...deletionUpdates }]);
      if (!result?.upserted) {
        throw new Error('Failed to delete property in database');
      }
    } else {
      await db.collection('properties').doc(id).update(deletionUpdates);
      if (isAppDbEnabled()) {
        await upsertPublicListings('properties', [{ id, ...propertyData, ...deletionUpdates }]).catch((error) => {
          console.warn('Failed to sync soft-delete to public listing mirror:', error?.message || error);
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Property deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting property:', error);
    return errorResponse('Failed to delete property', 'PROPERTY_DELETE_FAILED', 500);
  }
}
