'use client';
import React, { useState, useRef, useEffect } from 'react';
import { useLazyImage } from '@/hooks/usePerformance';
import { imageOptimization } from '@/utils/performance';

const LazyImage = ({
  src,
  alt,
  width,
  height,
  quality = 75,
  className = '',
  placeholder = 'blur',
  blurDataURL,
  sizes,
  priority = false,
  onLoad,
  onError,
  ...props
}) => {
  const [imageError, setImageError] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const optimizedSrc = imageOptimization.getOptimizedUrl(src, { width, quality });
  
  const { imgRef, isLoaded, isInView, src: loadedSrc } = useLazyImage(
    priority ? src : optimizedSrc,
    { threshold: 0.1 }
  );
  
  const handleLoad = (e) => {
    onLoad?.(e);
  };
  
  const handleError = (e) => {
    setImageError(true);
    setShowFallback(true);
    onError?.(e);
  };
  
  // Preload critical images
  useEffect(() => {
    if (priority && src) {
      imageOptimization.preloadImage(src);
    }
  }, [priority, src]);
  
  // Generate blur placeholder
  const getBlurPlaceholder = () => {
    if (blurDataURL) return blurDataURL;
    
    // Generate a simple gray blur placeholder
    const canvas = document.createElement('canvas');
    canvas.width = 40;
    canvas.height = 40;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, 40, 40);
    return canvas.toDataURL();
  };
  
  const placeholderSrc = placeholder === 'blur' ? getBlurPlaceholder() : null;
  
  if (imageError || showFallback) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-200 ${className}`}
        style={{ width, height }}
        {...props}
      >
        <div className="text-gray-400 text-center">
          <svg
            className="w-8 h-8 mx-auto mb-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span className="text-sm">Image unavailable</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className="relative" ref={imgRef}>
      {/* Placeholder/Loading state */}
      {!isLoaded && (
        <div
          className={`absolute inset-0 flex items-center justify-center ${
            placeholder === 'blur' ? 'bg-gray-100' : 'bg-gray-200'
          } ${className}`}
          style={{ width, height }}
        >
          {placeholder === 'blur' && placeholderSrc ? (
            <img
              src={placeholderSrc}
              alt=""
              className="w-full h-full object-cover filter blur-sm"
              style={{ width, height }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-gray-400">
              <svg
                className="w-6 h-6 mb-2 animate-spin"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span className="text-xs">Loading...</span>
            </div>
          )}
        </div>
      )}
      
      {/* Main image */}
      {(isInView || priority) && (
        <img
          src={loadedSrc}
          alt={alt}
          width={width}
          height={height}
          sizes={sizes}
          className={`transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          } ${className}`}
          onLoad={handleLoad}
          onError={handleError}
          loading={priority ? 'eager' : 'lazy'}
          {...props}
        />
      )}
    </div>
  );
};

export default LazyImage;