export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import listingRepository from '@/lib/db/listing-repository.cjs';

const { deletePublicListing, fetchPublicListingById, isAppDbEnabled } = listingRepository;

const ALLOWED_COLLECTIONS = ['properties', 'marketplace', 'housemates', 'noticeboard', 'services'];

// DELETE - Delete a specific ad
export async function DELETE(request, { params }) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const collection = String(searchParams.get('collection') || '').trim();

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection name is required' },
        { status: 400 }
      );
    }

    if (!ALLOWED_COLLECTIONS.includes(collection)) {
      return NextResponse.json(
        { error: 'Invalid collection name' },
        { status: 400 }
      );
    }

    const userId = authResult.userId || authResult.user?.uid;

    if (isAppDbEnabled()) {
      const publicListing = await fetchPublicListingById(collection, id);
      if (publicListing) {
        if (publicListing.userId !== userId) {
          return NextResponse.json(
            { error: 'You can only delete your own ads' },
            { status: 403 }
          );
        }

        await deletePublicListing(collection, id);

        const db = getAdminFirestore();
        const adRef = db.collection(collection).doc(id);
        const adDoc = await adRef.get().catch(() => null);
        if (adDoc?.exists) {
          await adRef.delete().catch((error) => {
            console.warn('Failed to delete Firestore source after public listing delete:', error?.message || error);
          });
        }

        return NextResponse.json({
          success: true,
          message: 'Ad deleted successfully'
        });
      }
    }

    // Initialize Firestore
    const db = getAdminFirestore();
    // Get the ad first to verify ownership
    const adRef = db.collection(collection).doc(id);
    const adDoc = await adRef.get();

    if (!adDoc.exists) {
      return NextResponse.json(
        { error: 'Ad not found' },
        { status: 404 }
      );
    }

    const adData = adDoc.data();

    // Verify user owns this ad
    if (adData.userId !== authResult.user.uid) {
      return NextResponse.json(
        { error: 'You can only delete your own ads' },
        { status: 403 }
      );
    }

    // Delete the ad
    await adRef.delete();
    await deletePublicListing(collection, id).catch((error) => {
      console.warn('Failed to delete public listing mirror:', error?.message || error);
    });

    return NextResponse.json({
      success: true,
      message: 'Ad deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting ad:', error);
    return NextResponse.json(
      { error: 'Failed to delete ad' },
      { status: 500 }
    );
  }
}
