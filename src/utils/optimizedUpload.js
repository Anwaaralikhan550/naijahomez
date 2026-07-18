import { ImageProcessor, compressImageForUpload } from '@/lib/imageProcessor';
import { getValidAccessToken } from '@/lib/auth/client-session';

/**
 * Enhanced upload service that pre-processes images before upload.
 */
export class OptimizedUpload {
  /**
   * Compress a file for upload when it exceeds the configured threshold.
   */
  static async prepareFileForUpload(file, options = {}) {
    const result = await compressImageForUpload(file, options);
    return result.file;
  }

  /**
   * Upload multiple processed sizes of an image.
   */
  static async uploadImageWithSizes(originalFile, options = {}) {
    const {
      sizeKeys = ['thumbnail', 'medium', 'large'],
      folder = 'uploads',
      generateUniqueName = true,
      userId = null
    } = options;

    try {
      ImageProcessor.validateImage(originalFile);
      const processedImages = await ImageProcessor.processImage(originalFile, sizeKeys);

      const timestamp = Date.now();
      const baseName = generateUniqueName
        ? `${timestamp}_${originalFile.name.replace(/\.[^/.]+$/, '')}`
        : originalFile.name.replace(/\.[^/.]+$/, '');

      const uploadPromises = Object.entries(processedImages).map(async ([sizeKey, imageData]) => {
        const fileName = `${baseName}_${sizeKey}.webp`;
        const uploadUrl = await this.uploadSingleFile(imageData.file, folder, fileName, userId, {
          thresholdBytes: Number.MAX_SAFE_INTEGER
        });

        return {
          [sizeKey]: {
            url: uploadUrl,
            size: imageData.size,
            dimensions: imageData.dimensions,
            filename: fileName
          }
        };
      });

      const uploadResults = await Promise.all(uploadPromises);
      const result = uploadResults.reduce((acc, curr) => ({ ...acc, ...curr }), {});

      result.original = {
        name: originalFile.name,
        size: originalFile.size,
        uploadedAt: new Date().toISOString()
      };

      return result;
    } catch (error) {
      console.error('Error in optimized upload:', error);
      throw error;
    }
  }

  /**
   * Upload a single file to /api/upload with optional pre-compression.
   */
  static async uploadSingleFile(file, folder = 'uploads', filename = null, userId = null, compressOptions = {}) {
    try {
      const token = await getValidAccessToken();
      if (!token) {
        throw new Error('Authentication required for upload');
      }

      const preparedFile = await this.prepareFileForUpload(file, compressOptions);
      const formData = new FormData();

      if (filename) {
        const customFile = new File([preparedFile], filename, { type: preparedFile.type });
        formData.append('file', customFile);
      } else {
        formData.append('file', preparedFile);
      }

      if (folder) {
        formData.append('folder', folder);
      }

      if (userId) {
        formData.append('userId', userId);
      }

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Upload failed: ${errorData.message || 'Unknown error'}`);
      }

      const data = await response.json();
      if (!data.url) {
        throw new Error('No URL returned from upload service');
      }

      return data.url;
    } catch (error) {
      console.error('Single file upload error:', error);
      throw error;
    }
  }

  static async uploadMultipleImages(files, options = {}) {
    const fileArray = Array.from(files);
    const results = [];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];

      try {
        const result = await this.uploadImageWithSizes(file, {
          ...options,
          folder: `${options.folder || 'uploads'}/${Date.now()}_${i}`
        });
        results.push(result);
      } catch (error) {
        results.push({
          error: error.message,
          originalFile: file.name
        });
      }
    }

    return results;
  }

  static getBestImageUrl(imageData, preferredSize = 'medium') {
    if (!imageData || typeof imageData !== 'object') {
      return null;
    }

    if (imageData[preferredSize]?.url) {
      return imageData[preferredSize].url;
    }

    const fallbackOrder = ['medium', 'large', 'small', 'thumbnail'];

    for (const size of fallbackOrder) {
      if (imageData[size]?.url) {
        return imageData[size].url;
      }
    }

    return null;
  }

  static getResponsiveImages(imageData) {
    if (!imageData || typeof imageData !== 'object') {
      return { src: null, srcSet: '', sizes: '' };
    }

    const srcSet = [];

    if (imageData.thumbnail?.url) {
      srcSet.push(`${imageData.thumbnail.url} 150w`);
    }
    if (imageData.small?.url) {
      srcSet.push(`${imageData.small.url} 400w`);
    }
    if (imageData.medium?.url) {
      srcSet.push(`${imageData.medium.url} 800w`);
    }
    if (imageData.large?.url) {
      srcSet.push(`${imageData.large.url} 1200w`);
    }

    return {
      src: this.getBestImageUrl(imageData, 'medium'),
      srcSet: srcSet.join(', '),
      sizes: '(max-width: 640px) 400px, (max-width: 1024px) 800px, 1200px'
    };
  }
}

export default OptimizedUpload;
