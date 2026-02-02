// app/api/delete-images/route.js
import { S3Client, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

export async function POST(request) {
  try {
    console.log('Bulk delete images request received - verifying authentication...');

    // CRITICAL: Verify authentication before allowing bulk deletions
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      console.error('Unauthorized bulk delete attempt blocked');
      return authResult.error;
    }

    const userId = authResult.userId;
    console.log('Authenticated bulk delete for user:', userId);

    const { imageUrls } = await request.json();

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return NextResponse.json({ 
        success: false,
        message: 'Invalid image URLs provided' 
      }, { status: 400 });
    }

    // Extract keys from full URLs and filter out any invalid ones
    const keys = imageUrls
      .filter(url => url && typeof url === 'string' && url.includes(process.env.AWS_S3_BUCKET_NAME))
      .map(url => {
        try {
          const urlPath = new URL(url).pathname;
          return urlPath.startsWith('/') ? urlPath.slice(1) : urlPath;
        } catch (e) {
          console.error('Invalid URL:', url);
          return null;
        }
      })
      .filter(key => key !== null);

    if (keys.length === 0) {
      return NextResponse.json({ 
        success: false,
        message: 'No valid image keys to delete' 
      }, { status: 400 });
    }

    const command = new DeleteObjectsCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Delete: {
        Objects: keys.map(Key => ({ Key }))
      }
    });

    const deleteResult = await s3Client.send(command);

    // Check for partial failures
    if (deleteResult.Errors && deleteResult.Errors.length > 0) {
      console.error('Some deletions failed:', deleteResult.Errors);
      return NextResponse.json({
        success: false,
        message: 'Some images failed to delete',
        errors: deleteResult.Errors
      }, { status: 207 }); // 207 Multi-Status
    }

    return NextResponse.json({ 
      success: true,
      message: 'All images deleted successfully',
      deleted: deleteResult.Deleted
    });
  } catch (error) {
    console.error('Error deleting S3 objects:', error);
    return NextResponse.json({ 
      success: false,
      message: 'Failed to delete images',
      error: error.message
    }, { status: 500 });
  }
}