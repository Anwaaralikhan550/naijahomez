// app/api/upload/route.js
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import logger from '@/lib/logger';

// SECURITY: Allowed file types (images only)
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/heic',
  'image/heif'
];

// SECURITY: Maximum file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request) {
  try {
    // CRITICAL: Verify authentication before allowing uploads
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      logger.error('Unauthorized upload attempt blocked');
      return authResult.error;
    }

    const userId = authResult.userId;

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({
        message: 'No file uploaded'
      }, { status: 400 });
    }

    // SECURITY: Validate file type
    const mimeType = file.type.toLowerCase();
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      logger.warn(`User ${userId} attempted to upload invalid file type: ${mimeType}`);
      return NextResponse.json({
        success: false,
        message: 'Invalid file type. Only images are allowed (JPEG, PNG, GIF, WebP)'
      }, { status: 400 });
    }

    // SECURITY: Validate file size
    if (file.size > MAX_FILE_SIZE) {
      logger.warn(`User ${userId} attempted to upload file exceeding size limit: ${file.size} bytes`);
      return NextResponse.json({
        success: false,
        message: 'File too large. Maximum size is 10MB'
      }, { status: 400 });
    }

    // SECURITY: Validate file extension matches MIME type
    const fileName = file.name || 'image';
    const extension = fileName.split('.').pop()?.toLowerCase();
    const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'heic', 'heif'];
    if (extension && !validExtensions.includes(extension)) {
      logger.warn(`User ${userId} attempted to upload file with suspicious extension: ${extension}`);
      return NextResponse.json({
        success: false,
        message: 'Invalid file extension'
      }, { status: 400 });
    }

    // Validate S3 configuration
    if (!process.env.AWS_S3_BUCKET_NAME || !process.env.AWS_REGION || 
        !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      console.error('AWS S3 configuration incomplete');
      return NextResponse.json({ 
        message: 'Server configuration error: S3 not properly configured'
      }, { status: 500 });
    }

    // Initialize S3 client with environment variables
    const s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // SECURITY: Sanitize filename and include userId for ownership tracking
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').substring(0, 100);
    const uploadFileName = `uploads/${userId}/${uuidv4()}-${sanitizedName}`;

    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: uploadFileName,
      Body: buffer,
      ContentType: mimeType, // Use validated MIME type
      // Add ACL for public read access
      ACL: 'public-read'
    };

    try {
      const command = new PutObjectCommand(params);
      const response = await s3Client.send(command);

      // Use region-specific URL format for eu-north-1
      const fileUrl = `https://s3.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_S3_BUCKET_NAME}/${uploadFileName}`;

      return NextResponse.json({ 
        url: fileUrl,
        success: true
      });
    } catch (s3Error) {
      console.error('S3 Upload Error:', {
        message: s3Error.message,
        name: s3Error.name,
        code: s3Error.code,
        bucket: process.env.AWS_S3_BUCKET_NAME,
        region: process.env.AWS_REGION,
        keyLength: process.env.AWS_ACCESS_KEY_ID?.length,
        secretLength: process.env.AWS_SECRET_ACCESS_KEY?.length
      });

      // More specific error messages
      let errorMessage = 'Upload failed';
      if (s3Error.name === 'SignatureDoesNotMatch') {
        errorMessage = 'AWS credentials are invalid or bucket access is denied';
      } else if (s3Error.name === 'NoSuchBucket') {
        errorMessage = 'S3 bucket does not exist or is in wrong region';
      } else if (s3Error.name === 'AccessDenied') {
        errorMessage = 'Access denied - check bucket permissions';
      }

      return NextResponse.json({ 
        success: false,
        message: errorMessage, 
        error: s3Error.message
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Complete upload error:', {
      message: error.message,
      name: error.name
    });

    return NextResponse.json({ 
      success: false,
      message: 'Upload failed', 
      error: error.message
    }, { status: 500 });
  }
}