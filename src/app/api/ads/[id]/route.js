import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';

// DELETE - Delete a specific ad
export async function DELETE(request, { params }) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const { id } = params;
    const { searchParams } = new URL(request.url);
    const collection = searchParams.get('collection');

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection name is required' },
        { status: 400 }
      );
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