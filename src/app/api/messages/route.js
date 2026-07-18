export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import logger from '@/lib/logger';

const FIRESTORE_INDEX_URL_REGEX = /(https:\/\/console\.firebase\.google\.com\/[^\s)\]]+)/i;

const errorResponse = (message, code, status = 500) =>
  NextResponse.json({ success: false, error: message, code }, { status });

const extractFirestoreIndexUrl = (error) => {
  const message = String(error?.message || '');
  const match = message.match(FIRESTORE_INDEX_URL_REGEX);
  return match?.[1] || null;
};

const isFirestoreMissingIndexError = (error) => {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();
  return (
    code === 'FAILED_PRECONDITION' ||
    code === '9' ||
    message.includes('failed precondition') ||
    (message.includes('index') && message.includes('create'))
  );
};

const runFirestoreRead = async (readOperation, context) => {
  try {
    return await readOperation();
  } catch (error) {
    if (isFirestoreMissingIndexError(error)) {
      const indexUrl = extractFirestoreIndexUrl(error);
      if (indexUrl) {
        logger.error(`[Firestore Index Required][${context}] ${indexUrl}`);
      }

      const wrappedError = new Error('Firestore index required');
      wrappedError.code = 'FIRESTORE_INDEX_REQUIRED';
      wrappedError.status = 503;
      wrappedError.indexUrl = indexUrl;
      wrappedError.context = context;
      throw wrappedError;
    }

    throw error;
  }
};

const firestoreErrorResponse = (error, fallbackMessage, fallbackCode) => {
  if (error?.code === 'FIRESTORE_INDEX_REQUIRED') {
    return NextResponse.json(
      {
        success: false,
        error: 'Firestore index required for this query',
        code: 'FIRESTORE_INDEX_REQUIRED',
        indexUrl: error?.indexUrl || null
      },
      { status: error?.status || 503 }
    );
  }

  return errorResponse(fallbackMessage, fallbackCode, 500);
};

const authErrorResponse = async (authError) => {
  const status = authError?.status || 401;
  const payload = await authError?.clone?.().json?.().catch(() => ({}));
  const message = payload?.error || 'Authentication required';
  const code = status === 403 ? 'FORBIDDEN' : status === 503 ? 'AUTH_SERVICE_UNAVAILABLE' : 'UNAUTHORIZED';
  return errorResponse(message, code, status);
};

export async function GET(request) {
  try {
    // Verify authentication using the auth middleware
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authErrorResponse(authResult.error);
    }

    const authenticatedUserId = authResult.userId;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'sent' or 'received'
    const userId = searchParams.get('userId');
    
    // Ensure user can only access their own messages
    if (userId !== authenticatedUserId) {
      return errorResponse('Forbidden - Cannot access other users messages', 'FORBIDDEN', 403);
    }

    if (!userId) {
      return errorResponse('User ID is required', 'USER_ID_REQUIRED', 400);
    }

    if (!type || !['sent', 'received'].includes(type)) {
      return errorResponse('Valid type parameter required (sent or received)', 'INVALID_MESSAGE_TYPE', 400);
    }

    // Initialize admin SDK and use admin Firestore
    const db = getAdminFirestore();
    const filterField = type === 'sent' ? 'senderId' : 'recipientId';
    const snapshot = await runFirestoreRead(
      () =>
        db.collection('messages')
          .where(filterField, '==', userId)
          .orderBy('createdAt', 'desc')
          .get(),
      `messages.list.${type}`
    );

    const messages = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Convert Firestore timestamp to ISO string
        createdAt: data.createdAt?.toDate().toISOString()
      };
    });

    return NextResponse.json({
      success: true,
      messages
    });

  } catch (error) {
    logger.error('Error fetching messages', error);
    return firestoreErrorResponse(error, 'Failed to fetch messages', 'MESSAGES_FETCH_FAILED');
  }
}

export async function POST(request) {
  try {
    // Verify authentication using the auth middleware
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authErrorResponse(authResult.error);
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
      return errorResponse('Forbidden - senderId must match authenticated user', 'FORBIDDEN', 403);
    }

    // Validate required fields
    if (!message || !recipientId || !listingId || !listingType || !senderId) {
      return errorResponse('Missing required fields', 'MESSAGE_FIELDS_REQUIRED', 400);
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
    return errorResponse('Failed to send message', 'MESSAGE_SEND_FAILED', 500);
  }
}
