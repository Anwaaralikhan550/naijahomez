/**
 * Client-side image processing utility
 * Compresses and resizes images before upload
 */

export class ImageProcessor {
  // Standard sizes for different use cases
  static SIZES = {
    thumbnail: { width: 150, height: 150, quality: 0.7 },
    small: { width: 400, height: 300, quality: 0.8 },
    medium: { width: 800, height: 600, quality: 0.85 },
    large: { width: 1200, height: 900, quality: 0.9 },
    hero: { width: 1920, height: 1080, quality: 0.9 }
  };

  /**
   * Process a single image file into multiple sizes
   * @param {File} file - The image file to process
   * @param {Array} sizeKeys - Array of size keys to generate (e.g., ['thumbnail', 'medium', 'large'])
   * @returns {Promise<Object>} Object with processed images for each size
   */
  static async processImage(file, sizeKeys = ['thumbnail', 'medium', 'large']) {
    const results = {};
    
    for (const sizeKey of sizeKeys) {
      if (!this.SIZES[sizeKey]) {
        console.warn(`Unknown size key: ${sizeKey}`);
        continue;
      }
      
      const config = this.SIZES[sizeKey];
      const processedBlob = await this.resizeAndCompress(file, config);
      
      results[sizeKey] = {
        blob: processedBlob,
        file: new File([processedBlob], `${sizeKey}_${file.name}`, {
          type: 'image/jpeg',
          lastModified: Date.now()
        }),
        size: processedBlob.size,
        dimensions: config
      };
    }
    
    return results;
  }

  /**
   * Resize and compress a single image
   * @param {File} file - The image file
   * @param {Object} config - Size and quality configuration
   * @returns {Promise<Blob>} Processed image blob
   */
  static async resizeAndCompress(file, { width, height, quality }) {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Calculate dimensions maintaining aspect ratio
        const { newWidth, newHeight } = this.calculateDimensions(
          img.width, 
          img.height, 
          width, 
          height
        );
        
        // Set canvas size
        canvas.width = newWidth;
        canvas.height = newHeight;
        
        // Draw and compress
        ctx.drawImage(img, 0, 0, newWidth, newHeight);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to create blob'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Calculate new dimensions maintaining aspect ratio
   */
  static calculateDimensions(originalWidth, originalHeight, maxWidth, maxHeight) {
    const aspectRatio = originalWidth / originalHeight;
    
    let newWidth = maxWidth;
    let newHeight = maxWidth / aspectRatio;
    
    if (newHeight > maxHeight) {
      newHeight = maxHeight;
      newWidth = maxHeight * aspectRatio;
    }
    
    return { newWidth: Math.round(newWidth), newHeight: Math.round(newHeight) };
  }

  /**
   * Get file size in human readable format
   */
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Validate image file
   */
  static validateImage(file) {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    if (!validTypes.includes(file.type)) {
      throw new Error('Invalid file type. Please upload JPEG, PNG, or WebP images.');
    }
    
    if (file.size > maxSize) {
      throw new Error('File too large. Please upload images smaller than 10MB.');
    }
    
    return true;
  }
}

// Helper hook for React components
export const useImageProcessor = () => {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const processImages = async (files, sizeKeys) => {
    setProcessing(true);
    setProgress(0);
    
    try {
      const results = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        ImageProcessor.validateImage(file);
        
        const processed = await ImageProcessor.processImage(file, sizeKeys);
        results.push(processed);
        
        setProgress((i + 1) / files.length * 100);
      }
      
      return results;
    } catch (error) {
      throw error;
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  };

  return { processImages, processing, progress };
};