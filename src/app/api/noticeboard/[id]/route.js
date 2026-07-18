export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuth } from 'firebase-admin/auth';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth, isAdmin } from '@/lib/auth-middleware';
import { normalizeImageFields } from '@/lib/hubFirestore';
import { fetchPublicListingById, isAppDbEnabled, upsertPublicListings } from '@/lib/db/listing-repository.cjs';

function toDateOrNull(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// New listings (created since the public_listings dedup) only exist in
// Postgres -- no Firestore-shim doc is written for them anymore. Older
// listings, or ones whose Postgres sync failed at creation time, may still
// only exist in the shim. Try Postgres first, fall back to the shim.
async function loadListing(db, id) {
  if (isAppDbEnabled()) {
    const listing = await fetchPublicListingById('noticeboard', id);
    if (listing) return { source: 'postgres', listing };
  }
  const doc = await db.collection('noticeboard').doc(id).get();
  if (doc.exists) return { source: 'firestore', listing: { id: doc.id, ...doc.data() } };
  return null;
}

// GET - Fetch a single noticeboard item
export async function GET(request, { params }) {
  try {
    const { id } = params;
    const db = getAdminFirestore();

    const found = await loadListing(db, id);
    if (!found) {
      return NextResponse.json(
        { error: 'Noticeboard item not found' },
        { status: 404 }
      );
    }

    const data = found.listing;
    const expiresAt = toDateOrNull(data.expiresAt);

    // Check if notice has expired
    if (expiresAt && expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Noticeboard item has expired' },
        { status: 410 }
      );
    }

    return NextResponse.json({
      success: true,
      data: normalizeImageFields({
        ...data,
        id,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
        expiresAt: expiresAt ? expiresAt.toISOString() : null
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
    const found = await loadListing(db, id);

    if (!found) {
      return NextResponse.json(
        { error: 'Noticeboard item not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    const noticeData = found.listing;
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

    if (found.source === 'postgres') {
      const result = await upsertPublicListings('noticeboard', [{ id, ...noticeData, ...updates }]);
      if (!result?.upserted) {
        throw new Error('Failed to update noticeboard item in database');
      }
    } else {
      await db.collection('noticeboard').doc(id).update(updates);
      if (isAppDbEnabled()) {
        await upsertPublicListings('noticeboard', [{ id, ...noticeData, ...updates }]).catch((error) => {
          console.warn('Failed to update public listing mirror:', error?.message || error);
        });
      }
    }

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
    const found = await loadListing(db, id);

    if (!found) {
      return NextResponse.json(
        { error: 'Noticeboard item not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    const noticeData = found.listing;
    if (noticeData.userId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden - You do not own this notice' },
        { status: 403 }
      );
    }

    // Soft delete - update status instead of deleting
    const deletionUpdates = {
      status: 'deleted',
      deletedAt: new Date(),
      updatedAt: new Date()
    };

    if (found.source === 'postgres') {
      const result = await upsertPublicListings('noticeboard', [{ id, ...noticeData, ...deletionUpdates }]);
      if (!result?.upserted) {
        throw new Error('Failed to delete noticeboard item in database');
      }
    } else {
      await db.collection('noticeboard').doc(id).update(deletionUpdates);
      if (isAppDbEnabled()) {
        await upsertPublicListings('noticeboard', [{ id, ...noticeData, ...deletionUpdates }]).catch((error) => {
          console.warn('Failed to sync soft-delete to public listing mirror:', error?.message || error);
        });
      }
    }

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
