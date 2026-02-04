import { ImageProcessor } from '@/lib/imageProcessor';
import { auth } from '@/lib/firebase-client';

/**
 * Enhanced upload service that pre-processes images before upload
 * This eliminates the need for Vercel's image optimization
 */

export class OptimizedUpload {
  /**
   * Upload multiple processed sizes of an image
   * @param {File} originalFile - The original image file
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} URLs for all sizes
   */
  static async uploadImageWithSizes(originalFile, options = {}) {
    const {
      sizeKeys = ['thumbnail', 'medium', 'large'],
      folder = 'uploads',
      generateUniqueName = true,
      userId = null
    } = options;

    try {
      // Validate the original image
      ImageProcessor.validateImage(originalFile);

      // Process image into multiple sizes
      console.log('Processing image into multiple sizes...');
      const processedImages = await ImageProcessor.processImage(originalFile, sizeKeys);

      // Generate base filename
      const timestamp = Date.now();
      const baseName = generateUniqueName 
        ? `${timestamp}_${originalFile.name.replace(/\.[^/.]+$/, "")}`
        : originalFile.name.replace(/\.[^/.]+$/, "");

      // Upload each size
      const uploadPromises = Object.entries(processedImages).map(async ([sizeKey, imageData]) => {
        const fileName = `${baseName}_${sizeKey}.jpg`;
        const uploadUrl = await this.uploadSingleFile(imageData.file, folder, fileName, userId);
        
        return {
          [sizeKey]: {
            url: uploadUrl,
            size: imageData.size,
            dimensions: imageData.dimensions,
            filename: fileName
          }
        };
      });

      // Wait for all uploads to complete
      const uploadResults = await Promise.all(uploadPromises);
      
      // Combine results into a single object
      const result = uploadResults.reduce((acc, curr) => ({ ...acc, ...curr }), {});

      // Add metadata
      result.original = {
        name: originalFile.name,
        size: originalFile.size,
        uploadedAt: new Date().toISOString()
      };

      console.log('All image sizes uploaded successfully:', result);
      return result;

    } catch (error) {
      console.error('Error in optimized upload:', error);
      throw error;
    }
  }

  /**
   * Upload a single file to S3 via the API
   * @param {File} file - The file to upload
   * @param {string} folder - S3 folder path
   * @param {string} filename - Custom filename
   * @param {string} userId - User ID for authentication (optional, will auto-detect)
   * @returns {Promise<string>} Upload URL
   */
  static async uploadSingleFile(file, folder = 'uploads', filename = null, userId = null) {
    try {
      // Get Firebase auth token for upload authorization
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Authentication required for upload');
      }
      const token = await currentUser.getIdToken();

      const formData = new FormData();

      // Use custom filename if provided
      if (filename) {
        const customFile = new File([file], filename, { type: file.type });
        formData.append('file', customFile);
      } else {
        formData.append('file', file);
      }

      if (folder) {
        formData.append('folder', folder);
      }

      // Add user ID for tracking (optional metadata)
      if (userId) {
        formData.append('userId', userId);
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

  /**
   * Upload multiple original files with processing
   * @param {FileList|Array} files - Files to upload
   * @param {Object} options - Upload options
   * @returns {Promise<Array>} Array of upload results
   */
  static async uploadMultipleImages(files, options = {}) {
    const fileArray = Array.from(files);
    const results = [];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      console.log(`Processing file ${i + 1}/${fileArray.length}: ${file.name}`);
      
      try {
        const result = await this.uploadImageWithSizes(file, {
          ...options,
          folder: `${options.folder || 'uploads'}/${Date.now()}_${i}`
        });
        results.push(result);
      } catch (error) {
        console.error(`Failed to process file ${file.name}:`, error);
        // Continue with other files, but track the error
        results.push({
          error: error.message,
          originalFile: file.name
        });
      }
    }

    return results;
  }

  /**
   * Get the appropriate image URL for a given screen size
   * @param {Object} imageData - Image data with multiple sizes
   * @param {string} preferredSize - Preferred size key
   * @returns {string} Best matching image URL
   */
  static getBestImageUrl(imageData, preferredSize = 'medium') {
    if (!imageData || typeof imageData !== 'object') {
      return null;
    }

    // If preferred size exists, use it
    if (imageData[preferredSize]?.url) {
      return imageData[preferredSize].url;
    }

    // Fallback order
    const fallbackOrder = ['medium', 'large', 'small', 'thumbnail'];
    
    for (const size of fallbackOrder) {
      if (imageData[size]?.url) {
        return imageData[size].url;
      }
    }

    return null;
  }

  /**
   * Generate responsive image sources for different screen sizes
   * @param {Object} imageData - Image data with multiple sizes
   * @returns {Object} Responsive image configuration
   */
  static getResponsiveImages(imageData) {
    if (!imageData || typeof imageData !== 'object') {
      return { src: null, srcSet: '', sizes: '' };
    }

    const srcSet = [];
    const sizes = [];

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