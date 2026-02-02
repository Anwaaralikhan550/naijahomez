// utils/imageUtils.js

/**
 * Process and load property images
 * @param {string|string[]} imageUrls - CSV string of image URLs or array of URLs
 * @param {Object} options - Configuration options
 * @returns {string[]} Processed image URLs
 */
export function processPropertyImages(imageUrls, options = {}) {
  const {
    placeholderFallback = '/api/placeholder/400/300',
    maxImages = 4
  } = options;

  // Handle empty or invalid input
  if (!imageUrls || (Array.isArray(imageUrls) && imageUrls.length === 0)) {
    return Array(maxImages).fill(placeholderFallback);
  }

  // Convert CSV string to array if needed
  let urlArray = imageUrls;
  if (typeof imageUrls === 'string') {
    urlArray = imageUrls.split(',').map(url => url.trim()).filter(url => url);
  }

  // Process and validate URLs
  const processedUrls = urlArray
    .map(url => validateImageUrl(url, placeholderFallback))
    .slice(0, maxImages);

  // Fill with placeholders if we don't have enough images
  while (processedUrls.length < maxImages) {
    processedUrls.push(placeholderFallback);
  }

  return processedUrls;
}
  
  /**
   * Process logo image with maintained aspect ratio
   * @param {string} logoUrl - URL of the logo image
   * @param {Object} options - Configuration options
   * @returns {Object} Logo image details
   */
  export function processLogoImage(logoUrl, options = {}) {
    const {
      defaultLogoUrl = '/nijahomzs-logo.png',
      maxHeight = 80,  // Maximum height in pixels
      maxWidth = 250   // Maximum width in pixels
    } = options;
  
    // Validate and use default if needed
    const validatedLogoUrl = validateImageUrl(logoUrl, defaultLogoUrl);
  
    return {
      src: validatedLogoUrl,
      width: 1368,   // Original logo width
      height: 392,   // Original logo height
      alt: "Nijahomzs Logo",
      style: {
        maxHeight: `${maxHeight}px`,
        maxWidth: `${maxWidth}px`,
        width: 'auto',
        height: 'auto',
        objectFit: 'contain'
      }
    };
  }
  
 /**
 * Validate and sanitize image URL
 * @param {string} url - Image URL to validate
 * @param {string} fallback - Fallback image URL
 * @returns {string} Validated image URL
 */
export function validateImageUrl(url, fallback = '/api/placeholder/400/300') {
  // Check if URL is empty or invalid
  if (!url || typeof url !== 'string') {
    return fallback;
  }

  // Trim whitespace
  const trimmedUrl = url.trim();
  
  // Check if it's a valid URL pattern
  try {
    // Handle relative URLs
    if (trimmedUrl.startsWith('/')) {
      return trimmedUrl;
    }
    
    // Handle S3 URLs and other absolute URLs
    if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
      // Basic validation - check if it's a properly formed URL
      new URL(trimmedUrl);
      return trimmedUrl;
    }
    
    // If it doesn't start with http or /, assume it's invalid
    return fallback;
  } catch (error) {
    // Invalid URL format
    return fallback;
  }
}