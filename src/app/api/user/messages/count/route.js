import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Count messages sent by this user
    const db = getAdminFirestore();
    let messagesSentCount = 0;

    try {
      const sentMessagesSnapshot = await db.collection('messages')
        .where('senderId', '==', userId)
        .get();
      
      messagesSentCount = sentMessagesSnapshot.size;
    } catch (error) {
      console.log('Messages collection might not exist or have different structure:', error.message);
      // Continue with 0 count if collection doesn't exist
    }

    return NextResponse.json({ count: messagesSentCount });
  } catch (error) {
    console.error('Error fetching user messages count:', error);
    return NextResponse.json({ error: 'Failed to fetch user messages count' }, { status: 500 });
  }
}