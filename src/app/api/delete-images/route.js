export const dynamic = 'force-dynamic';
// app/api/delete-images/route.js
import { S3Client, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import { getAdminFirestore } from '@/lib/firebase-admin';

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

async function verifyImageOwnership(db, userId, imageUrl, objectKey) {
  const collections = ['properties', 'marketplace', 'housemates', 'services'];

  for (const collectionName of collections) {
    if (await hasOwnedImage(db, collectionName, userId, imageUrl)) {
      return true;
    }
  }

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
    console.log('Bulk delete images request received - verifying authentication...');

    // CRITICAL: Verify authentication before allowing bulk deletions
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      console.error('Unauthorized bulk delete attempt blocked');
      return authErrorResponse(authResult.error);
    }

    const userId = authResult.userId;
    console.log('Authenticated bulk delete for user:', userId);

    const { imageUrls } = await request.json();

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return errorResponse('Invalid image URLs provided', 'IMAGE_URLS_INVALID', 400);
    }

    const db = getAdminFirestore();
    const validatedObjects = [];
    const rejected = [];

    for (const url of imageUrls) {
      if (!url || typeof url !== 'string') {
        rejected.push({ imageUrl: url, reason: 'invalid_url' });
        continue;
      }

      const key = extractObjectKey(url);
      if (!key) {
        rejected.push({ imageUrl: url, reason: 'invalid_url' });
        continue;
      }

      const isOwner = await verifyImageOwnership(db, userId, url, key);
      if (!isOwner) {
        rejected.push({ imageUrl: url, reason: 'not_owner' });
        continue;
      }

      validatedObjects.push({ imageUrl: url, key });
    }

    if (validatedObjects.length === 0) {
      return errorResponse('No owned image keys to delete', 'IMAGE_DELETE_FORBIDDEN', 403);
    }

    // Reject mixed requests to prevent deleting only a subset while non-owned keys are present.
    if (rejected.length > 0) {
      return errorResponse('Request contains non-owned or invalid images', 'IMAGE_DELETE_PARTIAL_FORBIDDEN', 403);
    }

    const command = new DeleteObjectsCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Delete: {
        Objects: validatedObjects.map(({ key }) => ({ Key: key }))
      }
    });

    const deleteResult = await s3Client.send(command);

    // Check for partial failures
    if (deleteResult.Errors && deleteResult.Errors.length > 0) {
      console.error('Some deletions failed:', deleteResult.Errors);
      return errorResponse('Some images failed to delete', 'IMAGE_DELETE_PARTIAL_FAILURE', 207);
    }

    return NextResponse.json({ 
      success: true,
      message: 'All images deleted successfully',
      deleted: deleteResult.Deleted
    });
  } catch (error) {
    console.error('Error deleting S3 objects:', error);
    return errorResponse('Failed to delete images', 'IMAGE_DELETE_FAILED', 500);
  }
}
