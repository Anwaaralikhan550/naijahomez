// utils/s3Upload.js
import { getValidAccessToken } from '@/lib/auth/client-session';
import { compressImageForUpload } from '@/lib/imageProcessor';
import { createDraft, getDraft, updateDraft } from '@/lib/client-drafts';

export const AD_IMAGE_ACCEPT = 'image/jpeg,image/jpg,image/png,image/gif,image/webp,image/avif,image/heic,image/heif';
export const AD_IMAGE_ALLOWED_MIME_TYPES = AD_IMAGE_ACCEPT.split(',');
export const AD_IMAGE_MAX_SIZE_BYTES = 10 * 1024 * 1024;

export const validateAdImageFiles = (files, toastHandler = null) => {
  return Array.from(files || []).filter((file) => {
    const isValidType = AD_IMAGE_ALLOWED_MIME_TYPES.includes(file.type);
    const isValidSize = file.size <= AD_IMAGE_MAX_SIZE_BYTES;

    if (!isValidType) {
      toastHandler?.(`${file.name} is not a supported image type. Use JPEG, PNG, GIF, WebP, AVIF, HEIC, or HEIF.`);
    }

    if (!isValidSize) {
      toastHandler?.(`${file.name} is too large (max 10MB)`);
    }

    return isValidType && isValidSize;
  });
};

export const uploadToS3 = async (file, draftId = null, userId = null, options = {}) => {
  try {
    console.log("Starting file upload to S3:", file.name);

    // Get auth token for upload authorization
    const token = await getValidAccessToken();
    if (!token) {
      throw new Error('Authentication required for upload');
    }

    const optimized = await compressImageForUpload(file, {
      thresholdBytes: 2 * 1024 * 1024,
      maxWidth: 1600,
      maxHeight: 1600,
      quality: 0.8,
      outputType: 'image/webp'
    });

    const formData = new FormData();
    formData.append('file', optimized.file);

    // Add user ID for tracking (optional metadata)
    if (userId) {
      formData.append('userId', userId);
    }

    if (options.watermark) {
      formData.append('watermark', 'true');
      formData.append('watermarkPlacement', options.watermarkPlacement || 'center');
    }

    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Upload API error:", errorData);
      throw new Error(`Upload failed: ${errorData.error || errorData.message || 'Unknown error'}`);
    }

    const data = await response.json();
    console.log("Upload response:", data);

    if (!data.url) {
      throw new Error('No URL returned from upload service');
    }

    const url = data.url;

    // Create or update the draft (Postgres-backed via /api/drafts, see client-drafts.js)
    if (!userId) throw new Error('User not authenticated');

    if (!draftId) {
      // Create new draft
      const draftRef = await createDraft({
        userId,
        status: 'draft',
        imageUrls: [url],
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log("Created new draft with image:", draftRef.id);
      return {
        url,
        draftId: draftRef.id,
        metadata: {
          name: file.name,
          originalSize: optimized.originalSize || file.size,
          compressedSize: optimized.compressedSize || optimized.file?.size || file.size,
          compressed: Boolean(optimized.compressed),
          mimeType: optimized.mimeType || optimized.file?.type || file.type,
          watermarked: Boolean(data.watermarked),
          uploadedAt: new Date().toISOString()
        }
      };
    } else {
      // Update existing draft
      const existingDraft = await getDraft(draftId).catch(() => ({ data: null }));
      const existingImages = Array.isArray(existingDraft.data?.imageUrls)
        ? existingDraft.data.imageUrls
        : [];

      await updateDraft(draftId, {
        imageUrls: [...new Set([...existingImages, url])],
        updatedAt: new Date()
      });
      console.log("Updated draft with new image:", draftId);
      return {
        url,
        draftId,
        metadata: {
          name: file.name,
          originalSize: optimized.originalSize || file.size,
          compressedSize: optimized.compressedSize || optimized.file?.size || file.size,
          compressed: Boolean(optimized.compressed),
          mimeType: optimized.mimeType || optimized.file?.type || file.type,
          watermarked: Boolean(data.watermarked),
          uploadedAt: new Date().toISOString()
        }
      };
    }
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
};
