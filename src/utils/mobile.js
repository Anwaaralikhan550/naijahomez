'use client';

/**
 * Mobile utility functions for responsive design and mobile-specific features
 */

// Detect if the user is on a mobile device
export const isMobile = () => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth <= 768;
};

// Detect if the user is on a tablet
export const isTablet = () => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth > 768 && window.innerWidth <= 1024;
};

// Detect touch device
export const isTouchDevice = () => {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

// Get viewport dimensions
export const getViewport = () => {
  if (typeof window === 'undefined') return { width: 0, height: 0 };
  return {
    width: window.innerWidth,
    height: window.innerHeight
  };
};

// Mobile-specific CSS classes
export const mobileClasses = {
  // Responsive grid classes
  responsiveGrid: {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
  },
  
  // Mobile-friendly spacing
  padding: {
    container: 'px-4 sm:px-6 lg:px-8',
    section: 'py-6 sm:py-8 lg:py-12',
    card: 'p-4 sm:p-6'
  },
  
  // Text sizing for mobile
  text: {
    h1: 'text-2xl sm:text-3xl lg:text-4xl',
    h2: 'text-xl sm:text-2xl lg:text-3xl',
    h3: 'text-lg sm:text-xl lg:text-2xl',
    body: 'text-sm sm:text-base',
    caption: 'text-xs sm:text-sm'
  },
  
  // Button sizing
  button: {
    small: 'px-3 py-1.5 text-sm sm:px-4 sm:py-2',
    medium: 'px-4 py-2 sm:px-6 sm:py-3',
    large: 'px-6 py-3 sm:px-8 sm:py-4'
  },
  
  // Modal/overlay behavior
  modal: {
    base: 'fixed inset-0 z-50 flex items-end sm:items-center justify-center',
    content: 'w-full max-w-md mx-4 sm:mx-0',
    fullMobile: 'fixed inset-0 sm:relative sm:rounded-lg'
  }
};

// Responsive breakpoint hooks
export const useBreakpoint = () => {
  if (typeof window === 'undefined') return 'desktop';
  
  const width = window.innerWidth;
  if (width < 640) return 'mobile';
  if (width < 768) return 'mobile-large';
  if (width < 1024) return 'tablet';
  if (width < 1280) return 'desktop';
  return 'desktop-large';
};

// Safe area insets for mobile devices with notches
export const getSafeAreaInsets = () => {
  if (typeof window === 'undefined') return { top: 0, bottom: 0, left: 0, right: 0 };
  
  const style = getComputedStyle(document.documentElement);
  return {
    top: parseInt(style.getPropertyValue('env(safe-area-inset-top)') || '0'),
    bottom: parseInt(style.getPropertyValue('env(safe-area-inset-bottom)') || '0'),
    left: parseInt(style.getPropertyValue('env(safe-area-inset-left)') || '0'),
    right: parseInt(style.getPropertyValue('env(safe-area-inset-right)') || '0')
  };
};

// Optimize images for mobile
export const getOptimizedImageUrl = (url, width = 800, quality = 80) => {
  if (!url) return '';
  
  // If it's already optimized or external, return as-is
  if (url.includes('?') || url.startsWith('http')) {
    return url;
  }
  
  return `${url}?w=${width}&q=${quality}&f=webp`;
};

// Handle mobile navigation
export const mobileNavigation = {
  // Prevent body scroll when modal/drawer is open
  lockScroll: () => {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden';
    }
  },
  
  // Restore body scroll
  unlockScroll: () => {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
    }
  },
  
  // Smooth scroll to element
  scrollToElement: (elementId, offset = 0) => {
    const element = document.getElementById(elementId);
    if (element) {
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  }
};

// Mobile form utilities
export const mobileForm = {
  // Auto-zoom prevention for iOS
  preventZoom: {
    fontSize: '16px', // Prevents zoom on iOS when focusing input
    WebkitAppearance: 'none' // Removes default styling
  },
  
  // Mobile-friendly input styles
  inputClasses: 'text-base sm:text-sm', // 16px prevents zoom on mobile
  
  // Keyboard handling
  handleVirtualKeyboard: {
    // Adjust viewport when keyboard appears
    adjustForKeyboard: () => {
      if (typeof window !== 'undefined' && 'visualViewport' in window) {
        const viewport = window.visualViewport;
        const adjust = () => {
          document.documentElement.style.setProperty(
            '--keyboard-height',
            `${window.innerHeight - viewport.height}px`
          );
        };
        
        viewport.addEventListener('resize', adjust);
        return () => viewport.removeEventListener('resize', adjust);
      }
    }
  }
};

// Performance optimizations for mobile
export const mobilePerformance = {
  // Lazy load images
  lazyLoadImage: (img, src) => {
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            img.src = src;
            observer.unobserve(img);
          }
        });
      }, { threshold: 0.1 });
      
      observer.observe(img);
    } else {
      img.src = src;
    }
  },
  
  // Debounce function for mobile events
  debounce: (func, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(null, args), delay);
    };
  },
  
  // Throttle function for scroll events
  throttle: (func, delay) => {
    let inThrottle;
    return (...args) => {
      if (!inThrottle) {
        func.apply(null, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, delay);
      }
    };
  }
};

// Mobile gesture utilities
export const mobileGestures = {
  // Swipe detection
  handleSwipe: (element, callbacks = {}) => {
    let startX, startY, distX, distY;
    const threshold = 50; // Minimum distance for swipe
    const allowedTime = 300; // Maximum time for swipe
    let startTime;
    
    const handleTouchStart = (e) => {
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      startTime = Date.now();
    };
    
    const handleTouchEnd = (e) => {
      const touch = e.changedTouches[0];
      distX = touch.clientX - startX;
      distY = touch.clientY - startY;
      const elapsedTime = Date.now() - startTime;
      
      if (elapsedTime <= allowedTime) {
        if (Math.abs(distX) >= threshold && Math.abs(distY) <= threshold) {
          // Horizontal swipe
          if (distX > 0 && callbacks.onSwipeRight) {
            callbacks.onSwipeRight();
          } else if (distX < 0 && callbacks.onSwipeLeft) {
            callbacks.onSwipeLeft();
          }
        } else if (Math.abs(distY) >= threshold && Math.abs(distX) <= threshold) {
          // Vertical swipe
          if (distY > 0 && callbacks.onSwipeDown) {
            callbacks.onSwipeDown();
          } else if (distY < 0 && callbacks.onSwipeUp) {
            callbacks.onSwipeUp();
          }
        }
      }
    };
    
    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }
};

export default {
  isMobile,
  isTablet,
  isTouchDevice,
  getViewport,
  mobileClasses,
  useBreakpoint,
  getSafeAreaInsets,
  getOptimizedImageUrl,
  mobileNavigation,
  mobileForm,
  mobilePerformance,
  mobileGestures
};