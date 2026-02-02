import React from 'react';
import { OptimizedUpload } from '@/utils/optimizedUpload';

/**
 * Optimized Image component that uses pre-processed images
 * This avoids Vercel's image optimization transformations
 */
const OptimizedImage = ({ 
  imageData, 
  preferredSize = 'medium',
  alt = '',
  className = '',
  loading = 'lazy',
  fallbackSrc = '/api/placeholder/400/300',
  ...props 
}) => {
  // Handle different data formats
  const getImageInfo = () => {
    // If it's already processed image data with multiple sizes
    if (imageData && typeof imageData === 'object' && !Array.isArray(imageData)) {
      const responsive = OptimizedUpload.getResponsiveImages(imageData);
      return {
        src: responsive.src || fallbackSrc,
        srcSet: responsive.srcSet,
        sizes: responsive.sizes
      };
    }
    
    // If it's a simple URL string
    if (typeof imageData === 'string') {
      return {
        src: imageData || fallbackSrc,
        srcSet: '',
        sizes: ''
      };
    }
    
    // If it's an array, use first item
    if (Array.isArray(imageData) && imageData.length > 0) {
      return getImageInfo(imageData[0]);
    }
    
    // Fallback
    return {
      src: fallbackSrc,
      srcSet: '',
      sizes: ''
    };
  };

  const { src, srcSet, sizes } = getImageInfo();

  // Don't render if no valid source
  if (!src) {
    return (
      <div className={`bg-gray-200 flex items-center justify-center ${className}`}>
        <span className="text-gray-500 text-sm">No Image</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      srcSet={srcSet || undefined}
      sizes={sizes || undefined}
      alt={alt}
      loading={loading}
      className={className}
      onError={(e) => {
        // Fallback to placeholder on error
        if (e.target.src !== fallbackSrc) {
          e.target.src = fallbackSrc;
        }
      }}
      {...props}
    />
  );
};

export default OptimizedImage;