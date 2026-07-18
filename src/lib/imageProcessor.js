/**
 * Shared image processing utilities
 * - Browser-side canvas compression before upload
 * - Server-side sharp optimization before S3 storage
 */

const BROWSER_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/heic',
  'image/heif'
];

const BROWSER_MAX_FILE_SIZE = 10 * 1024 * 1024;
const DEFAULT_BROWSER_THRESHOLD = 2 * 1024 * 1024;

export class ImageProcessor {
  // Standard sizes for optional multi-size generation
  static SIZES = {
    thumbnail: { width: 150, height: 150, quality: 0.7 },
    small: { width: 400, height: 300, quality: 0.8 },
    medium: { width: 800, height: 600, quality: 0.85 },
    large: { width: 1200, height: 900, quality: 0.85 },
    hero: { width: 1920, height: 1080, quality: 0.9 }
  };

  static isBrowser() {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
  }

  static validateImage(file) {
    if (!file) {
      throw new Error('No file provided');
    }

    if (!BROWSER_ALLOWED_MIME_TYPES.includes(file.type)) {
      throw new Error('Invalid file type. Please upload JPEG, PNG, WebP, AVIF, HEIC, or HEIF images.');
    }

    if (file.size > BROWSER_MAX_FILE_SIZE) {
      throw new Error('File too large. Please upload images smaller than 10MB.');
    }

    return true;
  }

  static shouldCompressInBrowser(file, thresholdBytes = DEFAULT_BROWSER_THRESHOLD) {
    if (!file) return false;
    return file.size > thresholdBytes;
  }

  static async processImage(file, sizeKeys = ['thumbnail', 'medium', 'large']) {
    const results = {};

    for (const sizeKey of sizeKeys) {
      if (!this.SIZES[sizeKey]) {
        continue;
      }

      const config = this.SIZES[sizeKey];
      const processedBlob = await this.resizeAndCompress(file, config);

      results[sizeKey] = {
        blob: processedBlob,
        file: new File([processedBlob], `${sizeKey}_${file.name.replace(/\.[^/.]+$/, '')}.webp`, {
          type: 'image/webp',
          lastModified: Date.now()
        }),
        size: processedBlob.size,
        dimensions: config
      };
    }

    return results;
  }

  static async resizeAndCompress(file, { width, height, quality = 0.8, outputType = 'image/webp', fit = 'contain' }) {
    if (!this.isBrowser()) {
      return file;
    }

    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        try {
          if (fit === 'cover') {
            canvas.width = width;
            canvas.height = height;
            const draw = this.calculateCoverDraw(img.width, img.height, width, height);
            ctx.drawImage(img, draw.x, draw.y, draw.width, draw.height);
          } else {
            const { newWidth, newHeight } = this.calculateDimensions(img.width, img.height, width, height);

            canvas.width = newWidth;
            canvas.height = newHeight;
            ctx.drawImage(img, 0, 0, newWidth, newHeight);
          }

          canvas.toBlob(
            (blob) => {
              URL.revokeObjectURL(img.src);
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Failed to create compressed image blob'));
              }
            },
            outputType,
            quality
          );
        } catch (error) {
          URL.revokeObjectURL(img.src);
          reject(error);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        reject(new Error('Failed to load image for compression'));
      };

      img.src = URL.createObjectURL(file);
    });
  }

  static calculateDimensions(originalWidth, originalHeight, maxWidth, maxHeight) {
    if (!originalWidth || !originalHeight) {
      return { newWidth: maxWidth, newHeight: maxHeight };
    }

    const aspectRatio = originalWidth / originalHeight;

    let newWidth = Math.min(originalWidth, maxWidth);
    let newHeight = newWidth / aspectRatio;

    if (newHeight > maxHeight) {
      newHeight = Math.min(originalHeight, maxHeight);
      newWidth = newHeight * aspectRatio;
    }

    return { newWidth: Math.round(newWidth), newHeight: Math.round(newHeight) };
  }

  static calculateCoverDraw(originalWidth, originalHeight, targetWidth, targetHeight) {
    if (!originalWidth || !originalHeight) {
      return { x: 0, y: 0, width: targetWidth, height: targetHeight };
    }

    const scale = Math.max(targetWidth / originalWidth, targetHeight / originalHeight);
    const width = originalWidth * scale;
    const height = originalHeight * scale;

    return {
      x: (targetWidth - width) / 2,
      y: (targetHeight - height) / 2,
      width,
      height
    };
  }

  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

/**
 * Browser-side pre-upload compression.
 * Compresses only when file exceeds threshold.
 */
export async function compressImageForUpload(file, options = {}) {
  const {
    thresholdBytes = DEFAULT_BROWSER_THRESHOLD,
    maxWidth = 1600,
    maxHeight = 1600,
    quality = 0.8,
    outputType = 'image/webp',
    fit = 'contain'
  } = options;

  ImageProcessor.validateImage(file);

  if (!ImageProcessor.isBrowser() || !ImageProcessor.shouldCompressInBrowser(file, thresholdBytes)) {
    return {
      file,
      compressed: false,
      originalSize: file.size,
      compressedSize: file.size,
      mimeType: file.type
    };
  }

  try {
    const blob = await ImageProcessor.resizeAndCompress(file, {
      width: maxWidth,
      height: maxHeight,
      quality,
      outputType,
      fit
    });

    const baseName = (file.name || 'image').replace(/\.[^/.]+$/, '');
    const optimizedFile = new File([blob], `${baseName}.webp`, {
      type: outputType,
      lastModified: Date.now()
    });

    // Keep original if compression produced bigger output
    if (optimizedFile.size >= file.size) {
      return {
        file,
        compressed: false,
        originalSize: file.size,
        compressedSize: file.size,
        mimeType: file.type
      };
    }

    return {
      file: optimizedFile,
      compressed: true,
      originalSize: file.size,
      compressedSize: optimizedFile.size,
      mimeType: outputType
    };
  } catch (error) {
    // Fail open to avoid blocking uploads
    return {
      file,
      compressed: false,
      originalSize: file.size,
      compressedSize: file.size,
      mimeType: file.type,
      error: error.message
    };
  }
}
