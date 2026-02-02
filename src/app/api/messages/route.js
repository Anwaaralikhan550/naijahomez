import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import logger from '@/lib/logger';

export async function GET(request) {
  try {
    // Verify authentication using the auth middleware
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const authenticatedUserId = authResult.userId;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'sent' or 'received'
    const userId = searchParams.get('userId');
    
    // Ensure user can only access their own messages
    if (userId !== authenticatedUserId) {
      return NextResponse.json(
        { error: 'Forbidden - Cannot access other users messages' },
        { status: 403 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (!type || !['sent', 'received'].includes(type)) {
      return NextResponse.json(
        { error: 'Valid type parameter required (sent or received)' },
        { status: 400 }
      );
    }

    // Initialize admin SDK and use admin Firestore
    const db = getAdminFirestore();
    let messagesRef = db.collection('messages');
    let queryRef;
    
    if (type === 'sent') {
      queryRef = messagesRef
        .where('senderId', '==', userId)
        .orderBy('createdAt', 'desc');
    } else {
      queryRef = messagesRef
        .where('recipientId', '==', userId)
        .orderBy('createdAt', 'desc');
    }

    const snapshot = await queryRef.get();
    const messages = [];
    
    snapshot.forEach(doc => {
      messages.push({
        id: doc.id,
        ...doc.data(),
        // Convert Firestore timestamp to ISO string
        createdAt: doc.data().createdAt?.toDate().toISOString()
      });
    });

    return NextResponse.json({
      success: true,
      messages
    });

  } catch (error) {
    logger.error('Error fetching messages', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    // Verify authentication using the auth middleware
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const authenticatedUserId = authResult.userId;

    const body = await request.json();
    const { 
      message, 
      recipientId, 
      listingId, 
      listingType, 
      senderName, 
      senderEmail, 
      senderId,
      isScrapedListing,
      originalSellerPhone,
      originalSellerEmail,
      originalSellerName
    } = body;
    
    // Verify sender ID matches authenticated user
    if (senderId !== authenticatedUserId) {
      return NextResponse.json(
        { error: 'Forbidden - senderId must match authenticated user' },
        { status: 403 }
      );
    }

    // Validate required fields
    if (!message || !recipientId || !listingId || !listingType || !senderId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Initialize admin SDK and use admin Firestore
    const db = getAdminFirestore();
    const messageData = {
      message: message.trim(),
      recipientId,
      senderId: authenticatedUserId, // Use verified user ID
      listingId,
      listingType, // 'property', 'marketplace', 'housemate', 'tradespeople', 'noticeboard'
      senderName: senderName || 'Anonymous',
      senderEmail: senderEmail || null,
      isRead: false,
      createdAt: new Date(),
      status: 'sent',
      // Additional fields for scraped listings
      isScrapedListing: isScrapedListing || false,
      originalSellerPhone: originalSellerPhone || null,
      originalSellerEmail: originalSellerEmail || null,
      originalSellerName: originalSellerName || null
    };

    const docRef = await db.collection('messages').add(messageData);

    return NextResponse.json({
      success: true,
      messageId: docRef.id,
      message: 'Message sent successfully'
    });

  } catch (error) {
    logger.error('Error sending message', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}