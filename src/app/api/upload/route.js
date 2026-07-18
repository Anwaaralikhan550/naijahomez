export const dynamic = 'force-dynamic';
// app/api/upload/route.js
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import logger from '@/lib/logger';
import path from 'path';
import { promises as fs } from 'fs';

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
const DEFAULT_WATERMARK_LOGO_PATH = path.join(process.cwd(), 'public', 'nijahomzs-logo.png');

function clampNumber(value, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(Math.max(parsed, min), max);
}

async function applyImageWatermark(inputBuffer, sharp, options = {}) {
  const {
    logoPath = DEFAULT_WATERMARK_LOGO_PATH,
    opacity = 0.42,
    widthRatio = 0.25,
    placement = 'center',
    paddingRatio = 0.04,
    innerPaddingRatio = 0.004,
    blurRadius = 8,
    tintOpacity = 0.02
  } = options;

  const image = sharp(inputBuffer, { failOnError: false }).rotate();
  const metadata = await image.metadata();
  const imageWidth = metadata.width || 0;
  const imageHeight = metadata.height || 0;

  if (!imageWidth || !imageHeight) {
    return inputBuffer;
  }

  const logoBuffer = await fs.readFile(logoPath);
  const watermarkWidth = Math.max(72, Math.round(imageWidth * clampNumber(widthRatio, 0.05, 0.6)));

  const watermarkPipeline = sharp(logoBuffer, { failOnError: false })
    .resize({
      width: watermarkWidth,
      fit: 'inside',
      withoutEnlargement: true
    })
    .ensureAlpha();

  const { data, info } = await watermarkPipeline
    .raw()
    .toBuffer({ resolveWithObject: true });

  const alphaOpacity = clampNumber(opacity, 0.1, 1);
  for (let index = 3; index < data.length; index += 4) {
    data[index] = Math.round(data[index] * alphaOpacity);
  }

  const transparentLogo = await sharp(data, { raw: info }).png().toBuffer();
  const logoMetadata = await sharp(transparentLogo).metadata();
  const logoWidth = logoMetadata.width || watermarkWidth;
  const logoHeight = logoMetadata.height || Math.round(watermarkWidth * 0.3);
  const outerPadding = Math.max(12, Math.round(imageWidth * clampNumber(paddingRatio, 0.01, 0.15)));
  const innerPadding = Math.max(3, Math.round(imageWidth * clampNumber(innerPaddingRatio, 0.002, 0.03)));
  const backgroundWidth = Math.min(imageWidth, logoWidth + innerPadding * 2);
  const verticalPadding = Math.max(0, Math.round(innerPadding * 0.15));
  const backgroundHeight = Math.min(imageHeight, logoHeight + verticalPadding * 2);

  const position =
    placement === 'bottom-right'
      ? {
          left: Math.max(0, imageWidth - backgroundWidth - outerPadding),
          top: Math.max(0, imageHeight - backgroundHeight - outerPadding)
        }
      : {
          left: Math.max(0, Math.round((imageWidth - backgroundWidth) / 2)),
          top: Math.max(0, Math.round((imageHeight - backgroundHeight) / 2))
        };

  const safeBackgroundWidth = Math.min(backgroundWidth, imageWidth - position.left);
  const safeBackgroundHeight = Math.min(backgroundHeight, imageHeight - position.top);
  const logoLeft = position.left + Math.max(0, Math.round((safeBackgroundWidth - logoWidth) / 2));
  const logoTop = position.top + Math.max(0, Math.round((safeBackgroundHeight - logoHeight) / 2));
  const tintOverlay = {
    create: {
      width: safeBackgroundWidth,
      height: safeBackgroundHeight,
      channels: 4,
      background: {
        r: 255,
        g: 255,
        b: 255,
        alpha: clampNumber(tintOpacity, 0, 0.6)
      }
    }
  };
  const featherSize = Math.max(8, Math.round(Math.min(safeBackgroundWidth, safeBackgroundHeight) * 0.12));
  const baseFeatherMask = await sharp({
    create: {
      width: safeBackgroundWidth,
      height: safeBackgroundHeight,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })
    .extend({
      top: featherSize,
      bottom: featherSize,
      left: featherSize,
      right: featherSize,
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    })
    .blur(featherSize / 2)
    .extract({
      left: featherSize,
      top: featherSize,
      width: safeBackgroundWidth,
      height: safeBackgroundHeight
    })
    .removeAlpha()
    .toBuffer();
  const organicWaveMask = Buffer.from(baseFeatherMask);
  const centerX = safeBackgroundWidth / 2;
  const centerY = safeBackgroundHeight / 2;
  const radiusX = safeBackgroundWidth / 2;
  const radiusY = safeBackgroundHeight / 2;

  for (let y = 0; y < safeBackgroundHeight; y += 1) {
    for (let x = 0; x < safeBackgroundWidth; x += 1) {
      const nx = (x - centerX) / radiusX;
      const ny = (y - centerY) / radiusY;
      const wave =
        0.9 +
        0.08 * Math.sin((ny * 7.1) + (nx * 3.4)) +
        0.06 * Math.cos((nx * 8.7) - (ny * 2.6));
      const distance = Math.sqrt((nx * nx) + (ny * ny)) / wave;
      const organicAlpha = Math.max(0, Math.min(1, 1 - Math.max(0, distance - 0.58) / 0.42));
      const index = (y * safeBackgroundWidth) + x;
      organicWaveMask[index] = Math.round(organicWaveMask[index] * organicAlpha);
    }
  }

  const featherMask = await sharp(organicWaveMask, {
    raw: {
      width: safeBackgroundWidth,
      height: safeBackgroundHeight,
      channels: 1
    }
  })
    .blur(Math.max(2, featherSize / 5))
    .toBuffer();
  const frostedBackground = await sharp(inputBuffer, { failOnError: false })
    .rotate()
    .extract({
      left: position.left,
      top: position.top,
      width: safeBackgroundWidth,
      height: safeBackgroundHeight
    })
    .blur(clampNumber(blurRadius, 1, 30))
    .composite([{ input: tintOverlay, blend: 'over' }])
    .joinChannel(featherMask)
    .png()
    .toBuffer();

  return image
    .composite([
      {
        input: frostedBackground,
        left: position.left,
        top: position.top,
        blend: 'over'
      },
      {
        input: transparentLogo,
        left: logoLeft,
        top: logoTop,
        blend: 'over'
      }
    ])
    .toBuffer();
}

/**
 * Server-side optimization before S3 upload.
 * Uses sharp when available; falls back to original buffer.
 */
async function optimizeImageBufferForUpload(buffer, mimeType, options = {}) {
  const {
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 80,
    forceWebp = true,
    watermark = false,
    watermarkOpacity = 0.42,
    watermarkWidthRatio = 0.25,
    watermarkPlacement = 'center'
  } = options;

  // Do not transform animated GIFs to avoid losing animation.
  if (mimeType === 'image/gif') {
    return {
      buffer,
      mimeType,
      extension: 'gif',
      optimized: false
    };
  }

  try {
    const sharpModule = await import('sharp');
    const sharp = sharpModule.default || sharpModule;

    let pipeline = sharp(buffer, { failOnError: false, animated: true }).rotate();

    pipeline = pipeline.resize({
      width: maxWidth,
      height: maxHeight,
      fit: 'inside',
      withoutEnlargement: true
    });

    if (watermark) {
      const resizedBuffer = await pipeline.toBuffer();
      const watermarkedBuffer = await applyImageWatermark(resizedBuffer, sharp, {
        opacity: watermarkOpacity,
        widthRatio: watermarkWidthRatio,
        placement: watermarkPlacement,
        blurRadius: 8,
        tintOpacity: 0.02
      });
      pipeline = sharp(watermarkedBuffer, { failOnError: false }).rotate();
    }

    let optimizedBuffer;
    let outputMimeType;
    let extension;

    if (forceWebp) {
      optimizedBuffer = await pipeline.webp({ quality, effort: 4 }).toBuffer();
      outputMimeType = 'image/webp';
      extension = 'webp';
    } else {
      optimizedBuffer = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
      outputMimeType = 'image/jpeg';
      extension = 'jpg';
    }

    if (!optimizedBuffer || optimizedBuffer.length === 0) {
      return {
        buffer,
        mimeType,
        extension: mimeType.split('/')[1] || 'jpg',
        optimized: false
      };
    }

    // Keep original if optimized payload is larger
    if (!watermark && optimizedBuffer.length >= buffer.length) {
      return {
        buffer,
        mimeType,
        extension: mimeType.split('/')[1] || 'jpg',
        optimized: false
      };
    }

    return {
      buffer: optimizedBuffer,
      mimeType: outputMimeType,
      extension,
      optimized: true,
      watermarked: Boolean(watermark),
      originalSize: buffer.length,
      optimizedSize: optimizedBuffer.length
    };
  } catch (error) {
    return {
      buffer,
      mimeType,
      extension: mimeType.split('/')[1] || 'jpg',
      optimized: false,
      error: error.message
    };
  }
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
    // CRITICAL: Verify authentication before allowing uploads
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      logger.error('Unauthorized upload attempt blocked');
      return authErrorResponse(authResult.error);
    }

    const userId = authResult.userId;

    const formData = await request.formData();
    const file = formData.get('file');
    const watermarkRequested = String(formData.get('watermark') || '').toLowerCase() === 'true';
    const watermarkPlacement = String(formData.get('watermarkPlacement') || 'center').toLowerCase();

    if (!file) {
      return errorResponse('No file uploaded', 'UPLOAD_FILE_REQUIRED', 400);
    }

    // SECURITY: Validate file type
    const mimeType = file.type.toLowerCase();
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      logger.warn(`User ${userId} attempted to upload invalid file type: ${mimeType}`);
      return errorResponse(
        'Invalid file type. Only images are allowed (JPEG, PNG, GIF, WebP)',
        'UPLOAD_INVALID_FILE_TYPE',
        400
      );
    }

    // SECURITY: Validate file size
    if (file.size > MAX_FILE_SIZE) {
      logger.warn(`User ${userId} attempted to upload file exceeding size limit: ${file.size} bytes`);
      return errorResponse('File too large. Maximum size is 10MB', 'UPLOAD_FILE_TOO_LARGE', 400);
    }

    // SECURITY: Validate file extension matches MIME type
    const fileName = file.name || 'image';
    const extension = fileName.split('.').pop()?.toLowerCase();
    const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'heic', 'heif'];
    if (extension && !validExtensions.includes(extension)) {
      logger.warn(`User ${userId} attempted to upload file with suspicious extension: ${extension}`);
      return errorResponse('Invalid file extension', 'UPLOAD_INVALID_EXTENSION', 400);
    }

    // Validate S3 configuration
    if (!process.env.AWS_S3_BUCKET_NAME || !process.env.AWS_REGION || 
        !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      console.error('AWS S3 configuration incomplete');
      return errorResponse(
        'Server configuration error: S3 not properly configured',
        'S3_CONFIGURATION_ERROR',
        500
      );
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
    const originalBuffer = Buffer.from(bytes);
    const optimizedImage = await optimizeImageBufferForUpload(originalBuffer, mimeType, {
      maxWidth: 1200,
      maxHeight: 1200,
      quality: 80,
      forceWebp: true,
      watermark: watermarkRequested,
      watermarkOpacity: 0.42,
      watermarkWidthRatio: 0.25,
      watermarkPlacement: watermarkPlacement === 'bottom-right' ? 'bottom-right' : 'center'
    });

    const uploadBuffer = optimizedImage.buffer;
    const uploadMimeType = optimizedImage.mimeType || mimeType;

    // SECURITY: Sanitize filename and include userId for ownership tracking
    const baseName = (file.name || 'image')
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .substring(0, 100);
    const fileExtension = optimizedImage.extension || extension || 'jpg';
    const uploadFileName = `uploads/${userId}/${uuidv4()}-${baseName}.${fileExtension}`;

    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: uploadFileName,
      Body: uploadBuffer,
      ContentType: uploadMimeType,
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
        watermarked: Boolean(optimizedImage.watermarked),
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
      let errorCode = 'S3_UPLOAD_FAILED';
      if (s3Error.name === 'SignatureDoesNotMatch') {
        errorMessage = 'AWS credentials are invalid or bucket access is denied';
        errorCode = 'S3_SIGNATURE_MISMATCH';
      } else if (s3Error.name === 'NoSuchBucket') {
        errorMessage = 'S3 bucket does not exist or is in wrong region';
        errorCode = 'S3_BUCKET_NOT_FOUND';
      } else if (s3Error.name === 'AccessDenied') {
        errorMessage = 'Access denied - check bucket permissions';
        errorCode = 'S3_ACCESS_DENIED';
      }

      return errorResponse(errorMessage, errorCode, 500);
    }

  } catch (error) {
    console.error('Complete upload error:', {
      message: error.message,
      name: error.name
    });

    return errorResponse('Upload failed', 'UPLOAD_FAILED', 500);
  }
}
