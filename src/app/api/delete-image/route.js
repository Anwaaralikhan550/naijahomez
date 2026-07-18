export const dynamic = 'force-dynamic';
// app/api/delete-image/route.js
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import { getAdminFirestore } from '@/lib/firebase-admin';
import logger from '@/lib/logger';
import { hasOwnedListingImage } from '@/lib/db/listing-repository.cjs';

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

function extractObjectKey(imageUrl) {
  try {
    const urlPath = new URL(imageUrl).pathname;
    const key = urlPath.startsWith('/') ? urlPath.slice(1) : urlPath;
    return key || null;
  } catch {
    return null;
  }
}

async function hasOwnedImage(db, collectionName, userId, imageUrl) {
  const fields = ['imageUrls', 'images'];

  for (const field of fields) {
    try {
      const snapshot = await db.collection(collectionName)
        .where('userId', '==', userId)
        .where(field, 'array-contains', imageUrl)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        return true;
      }
    } catch (error) {
      continue;
    }
  }

  return false;
}

// Helper to verify image ownership by checking associated listings
async function verifyImageOwnership(db, userId, imageUrl, objectKey) {
  // New listings only live in public_listings (Postgres) -- check there first.
  if (await hasOwnedListingImage(userId, imageUrl)) return true;

  // Fall back to the Firestore-shim collections for older listings.
  if (await hasOwnedImage(db, 'properties', userId, imageUrl)) return true;
  if (await hasOwnedImage(db, 'marketplace', userId, imageUrl)) return true;
  if (await hasOwnedImage(db, 'housemates', userId, imageUrl)) return true;
  if (await hasOwnedImage(db, 'services', userId, imageUrl)) return true;

  // Allow draft uploads only when they are under the authenticated user's folder.
  if (objectKey && objectKey.startsWith(`uploads/${userId}/`)) {
    return true;
  }

  return false;
}

export async function POST(request) {
  const errorResponse = (message, code, status = 500) =>
    NextResponse.json({ success: false, error: message, code }, { status });
  const authErrorResponse = async (authError) => {
    const status = authError?.status || 401;
    const payload = await authError?.clone?.().json?.().catch(() => ({}));
    const message = payload?.error || 'Authentication required';
    const code = status === 403 ? 'FORBIDDEN' : status === 503 ? 'AUTH_SERVICE_UNAVAILABLE' : 'UNAUTHORIZED';
    return errorResponse(message, code, status);
  };

  try {
    // CRITICAL: Verify authentication before allowing deletions
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      logger.error('Unauthorized delete attempt blocked');
      return authErrorResponse(authResult.error);
    }

    const userId = authResult.userId;
    const { imageUrl } = await request.json();

    if (!imageUrl) {
      return errorResponse('No image URL provided', 'IMAGE_URL_REQUIRED', 400);
    }

    const objectKey = extractObjectKey(imageUrl);
    if (!objectKey) {
      return errorResponse('Invalid image URL provided', 'IMAGE_URL_INVALID', 400);
    }

    // SECURITY: Always verify trusted ownership on the server.
    const db = getAdminFirestore();
    const isOwner = await verifyImageOwnership(db, userId, imageUrl, objectKey);
    if (!isOwner) {
      logger.warn(`User ${userId} attempted to delete image they don't own: ${imageUrl}`);
      return errorResponse('You do not have permission to delete this image', 'IMAGE_DELETE_FORBIDDEN', 403);
    }

    const command = new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: objectKey
    });

    await s3Client.send(command);

    return NextResponse.json({
      success: true,
      message: 'Image deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting S3 object', error);
    return errorResponse('Failed to delete image', 'IMAGE_DELETE_FAILED', 500);
  }
}
