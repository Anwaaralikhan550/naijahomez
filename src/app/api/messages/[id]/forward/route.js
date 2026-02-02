import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { db } from '@/lib/firestore';

import { verifyAuth, isAdmin } from '@/lib/auth-middleware';

export async function PATCH(request, { params }) {
  try {
    // Initialize admin SDK
    const db = getAdminFirestore();

    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const userId = authResult.userId;
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'Message ID is required' },
        { status: 400 }
      );
    }

    // Check if message exists
    const messageRef = doc(db, 'messages', id);
    const messageSnap = await getDoc(messageRef);

    if (!messageSnap.exists()) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    // Mark message as forwarded and read
    await updateDoc(messageRef, {
      isForwarded: true,
      isRead: true,
      forwardedAt: new Date()
    });

    return NextResponse.json({
      success: true,
      message: 'Message marked as forwarded'
    });

  } catch (error) {
    console.error('Error marking message as forwarded:', error);
    return NextResponse.json(
      { error: 'Failed to mark message as forwarded' },
      { status: 500 }
    );
  }
}