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
import { fetchPublicListingById, isAppDbEnabled, upsertPublicListings } from '@/lib/db/listing-repository.cjs';

// New listings (created since the public_listings dedup) only exist in
// Postgres -- no Firestore-shim doc is written for them anymore. Older
// listings, or ones whose Postgres sync failed at creation time, may still
// only exist in the shim. Try Postgres first, fall back to the shim.
async function loadListing(db, id) {
  if (isAppDbEnabled()) {
    const listing = await fetchPublicListingById('services', id);
    if (listing) return { source: 'postgres', listing };
  }
  const doc = await db.collection('services').doc(id).get();
  if (doc.exists) return { source: 'firestore', listing: { id: doc.id, ...doc.data() } };
  return null;
}

// GET - Fetch a single service/tradesperson
export async function GET(request, { params }) {
  try {
    const { id } = params;
    const db = getAdminFirestore();

    const found = await loadListing(db, id);
    if (!found) {
      return errorResponse('Service not found', 'SERVICE_NOT_FOUND', 404);
    }

    const data = found.listing;
    return NextResponse.json({
      success: true,
      data: normalizeImageFields({
        ...data,
        id,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt
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
    const found = await loadListing(db, id);

    if (!found) {
      return errorResponse('Service not found', 'SERVICE_NOT_FOUND', 404);
    }

    // Verify ownership
    const serviceData = found.listing;
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

    if (found.source === 'postgres') {
      const result = await upsertPublicListings('services', [{ id, ...serviceData, ...updates }]);
      if (!result?.upserted) {
        throw new Error('Failed to update service in database');
      }
    } else {
      await db.collection('services').doc(id).update(updates);
      if (isAppDbEnabled()) {
        await upsertPublicListings('services', [{ id, ...serviceData, ...updates }]).catch((error) => {
          console.warn('Failed to update public listing mirror:', error?.message || error);
        });
      }
    }

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
    const found = await loadListing(db, id);

    if (!found) {
      return errorResponse('Service not found', 'SERVICE_NOT_FOUND', 404);
    }

    // Verify ownership
    const serviceData = found.listing;
    if (serviceData.userId !== userId) {
      return errorResponse('Forbidden - You do not own this service', 'FORBIDDEN', 403);
    }

    // Soft delete - update status instead of deleting
    const deletionUpdates = {
      status: 'deleted',
      deletedAt: new Date(),
      updatedAt: new Date()
    };

    if (found.source === 'postgres') {
      const result = await upsertPublicListings('services', [{ id, ...serviceData, ...deletionUpdates }]);
      if (!result?.upserted) {
        throw new Error('Failed to delete service in database');
      }
    } else {
      await db.collection('services').doc(id).update(deletionUpdates);
      if (isAppDbEnabled()) {
        await upsertPublicListings('services', [{ id, ...serviceData, ...deletionUpdates }]).catch((error) => {
          console.warn('Failed to sync soft-delete to public listing mirror:', error?.message || error);
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Service deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting service:', error);
    return errorResponse('Failed to delete service', 'SERVICE_DELETE_FAILED', 500);
  }
}
