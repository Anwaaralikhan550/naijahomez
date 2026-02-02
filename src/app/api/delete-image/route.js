// app/api/delete-image/route.js
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import { getAdminFirestore } from '@/lib/firebase-admin';
import logger from '@/lib/logger';

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// Helper to verify image ownership by checking associated listings
async function verifyImageOwnership(db, userId, imageUrl) {
  // Check properties collection
  const propsQuery = await db.collection('properties')
    .where('userId', '==', userId)
    .where('images', 'array-contains', imageUrl)
    .limit(1)
    .get();
  if (!propsQuery.empty) return true;

  // Check marketplace collection
  const marketQuery = await db.collection('marketplace')
    .where('userId', '==', userId)
    .where('images', 'array-contains', imageUrl)
    .limit(1)
    .get();
  if (!marketQuery.empty) return true;

  // Check housemates collection
  const housematesQuery = await db.collection('housemates')
    .where('userId', '==', userId)
    .where('images', 'array-contains', imageUrl)
    .limit(1)
    .get();
  if (!housematesQuery.empty) return true;

  // Check services/tradespeople collection
  const servicesQuery = await db.collection('services')
    .where('userId', '==', userId)
    .where('images', 'array-contains', imageUrl)
    .limit(1)
    .get();
  if (!servicesQuery.empty) return true;

  // Check if URL path contains the user ID (for draft uploads)
  if (imageUrl.includes(`/uploads/${userId}/`) || imageUrl.includes(`uploads/${userId}`)) {
    return true;
  }

  return false;
}

export async function POST(request) {
  try {
    // CRITICAL: Verify authentication before allowing deletions
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      logger.error('Unauthorized delete attempt blocked');
      return authResult.error;
    }

    const userId = authResult.userId;
    const { imageUrl, draftId, skipOwnershipCheck } = await request.json();

    if (!imageUrl) {
      return NextResponse.json({
        success: false,
        message: 'No image URL provided'
      }, { status: 400 });
    }

    // SECURITY: Verify ownership unless explicitly skipped for draft cleanup
    // Only skip ownership check for draft images that contain the user's ID
    const db = getAdminFirestore();

    if (!skipOwnershipCheck || !imageUrl.includes(userId)) {
      const isOwner = await verifyImageOwnership(db, userId, imageUrl);
      if (!isOwner) {
        logger.warn(`User ${userId} attempted to delete image they don't own: ${imageUrl}`);
        return NextResponse.json({
          success: false,
          message: 'You do not have permission to delete this image'
        }, { status: 403 });
      }
    }

    // Extract key from full URL
    const urlPath = new URL(imageUrl).pathname;
    const key = urlPath.startsWith('/') ? urlPath.slice(1) : urlPath;

    const command = new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: key
    });

    await s3Client.send(command);

    return NextResponse.json({
      success: true,
      message: 'Image deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting S3 object', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to delete image',
      error: error.message
    }, { status: 500 });
  }
}