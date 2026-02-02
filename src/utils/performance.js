'use client';

/**
 * Performance optimization utilities
 */

// Image lazy loading and optimization
export const imageOptimization = {
  // Create optimized image URL with Next.js optimization
  getOptimizedUrl: (src, options = {}) => {
    if (!src) return '';
    
    const {
      width = 800,
      quality = 75,
      format = 'webp'
    } = options;
    
    // If it's already optimized or external URL, return as is
    if (src.includes('?') || src.startsWith('http')) {
      return src;
    }
    
    return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality}&f=${format}`;
  },
  
  // Lazy load image with intersection observer
  lazyLoad: (img, src, options = {}) => {
    const { threshold = 0.1, rootMargin = '50px' } = options;
    
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            img.src = src;
            img.classList.remove('opacity-0');
            img.classList.add('opacity-100');
            observer.unobserve(img);
          }
        });
      }, { threshold, rootMargin });
      
      observer.observe(img);
      return () => observer.unobserve(img);
    } else {
      // Fallback for browsers without IntersectionObserver
      img.src = src;
      img.classList.add('opacity-100');
    }
  },
  
  // Preload critical images
  preloadImage: (src) => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = src;
    document.head.appendChild(link);
  }
};

// Component performance optimizations
export const componentOptimization = {
  // Debounce function for expensive operations
  debounce: (func, delay = 300) => {
    let timeoutId;
    const debounced = (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(null, args), delay);
    };
    debounced.cancel = () => clearTimeout(timeoutId);
    return debounced;
  },
  
  // Throttle function for frequent events
  throttle: (func, delay = 100) => {
    let inThrottle;
    return (...args) => {
      if (!inThrottle) {
        func.apply(null, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, delay);
      }
    };
  },
  
  // Virtual scrolling helper
  getVisibleItems: (items, containerHeight, itemHeight, scrollTop) => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight) + 1,
      items.length
    );
    
    return {
      startIndex: Math.max(0, startIndex),
      endIndex,
      visibleItems: items.slice(startIndex, endIndex),
      totalHeight: items.length * itemHeight,
      offsetY: startIndex * itemHeight
    };
  }
};

// Memory management
export const memoryOptimization = {
  // Cleanup function for component unmounting
  cleanup: (cleanupFunctions) => {
    return () => {
      cleanupFunctions.forEach(cleanup => {
        if (typeof cleanup === 'function') {
          cleanup();
        }
      });
    };
  },
  
  // Weak map for storing component data
  createWeakCache: () => {
    return new WeakMap();
  },
  
  // Cancel pending promises
  createCancelablePromise: (promise) => {
    let isCanceled = false;
    
    const wrappedPromise = new Promise((resolve, reject) => {
      promise
        .then(result => isCanceled ? reject({ isCanceled: true }) : resolve(result))
        .catch(error => isCanceled ? reject({ isCanceled: true }) : reject(error));
    });
    
    return {
      promise: wrappedPromise,
      cancel: () => { isCanceled = true; }
    };
  }
};

// Bundle and code splitting utilities
export const bundleOptimization = {
  // Dynamic import with error handling
  dynamicImport: async (importFn, fallback = null) => {
    try {
      const module = await importFn();
      return module.default || module;
    } catch (error) {
      console.error('Dynamic import failed:', error);
      return fallback;
    }
  },
  
  // Preload component
  preloadComponent: (importFn) => {
    if (typeof window !== 'undefined') {
      // Use requestIdleCallback if available
      if (window.requestIdleCallback) {
        window.requestIdleCallback(() => importFn());
      } else {
        setTimeout(() => importFn(), 100);
      }
    }
  }
};

// API and data optimization
export const dataOptimization = {
  // Simple cache with TTL
  createCache: (ttl = 5 * 60 * 1000) => { // 5 minutes default
    const cache = new Map();
    
    return {
      get: (key) => {
        const item = cache.get(key);
        if (!item) return null;
        
        if (Date.now() > item.expiry) {
          cache.delete(key);
          return null;
        }
        
        return item.data;
      },
      set: (key, data) => {
        cache.set(key, {
          data,
          expiry: Date.now() + ttl
        });
      },
      delete: (key) => cache.delete(key),
      clear: () => cache.clear(),
      size: () => cache.size
    };
  },
  
  // Batch API requests
  createBatcher: (batchFn, delay = 50, maxBatchSize = 10) => {
    let batch = [];
    let timeoutId;
    
    return (item) => {
      return new Promise((resolve, reject) => {
        batch.push({ item, resolve, reject });
        
        if (batch.length >= maxBatchSize) {
          processBatch();
        } else {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(processBatch, delay);
        }
      });
    };
    
    function processBatch() {
      if (batch.length === 0) return;
      
      const currentBatch = batch.splice(0, maxBatchSize);
      const items = currentBatch.map(b => b.item);
      
      batchFn(items)
        .then(results => {
          currentBatch.forEach((b, index) => {
            b.resolve(results[index]);
          });
        })
        .catch(error => {
          currentBatch.forEach(b => b.reject(error));
        });
    }
  },
  
  // Request deduplication
  createDeduplicator: () => {
    const pendingRequests = new Map();
    
    return async (key, requestFn) => {
      if (pendingRequests.has(key)) {
        return pendingRequests.get(key);
      }
      
      const promise = requestFn()
        .finally(() => {
          pendingRequests.delete(key);
        });
      
      pendingRequests.set(key, promise);
      return promise;
    };
  }
};

// Performance monitoring
export const performanceMonitoring = {
  // Measure function execution time
  measureTime: (name, fn) => {
    return async (...args) => {
      const start = performance.now();
      try {
        const result = await fn(...args);
        const duration = performance.now() - start;
        console.log(`${name} took ${duration.toFixed(2)}ms`);
        return result;
      } catch (error) {
        const duration = performance.now() - start;
        console.log(`${name} failed after ${duration.toFixed(2)}ms`);
        throw error;
      }
    };
  },
  
  // Monitor component render performance
  measureRender: (componentName) => {
    if (typeof performance !== 'undefined' && performance.mark) {
      const startMark = `${componentName}-render-start`;
      const endMark = `${componentName}-render-end`;
      
      return {
        start: () => performance.mark(startMark),
        end: () => {
          performance.mark(endMark);
          performance.measure(`${componentName}-render`, startMark, endMark);
        }
      };
    }
    
    return {
      start: () => {},
      end: () => {}
    };
  },
  
  // Monitor memory usage
  getMemoryInfo: () => {
    if (typeof performance !== 'undefined' && performance.memory) {
      return {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
      };
    }
    return null;
  }
};

// Critical resource hints
export const resourceOptimization = {
  // Preconnect to external domains
  preconnect: (url) => {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = url;
    document.head.appendChild(link);
  },
  
  // DNS prefetch for external domains
  dnsPrefetch: (url) => {
    const link = document.createElement('link');
    link.rel = 'dns-prefetch';
    link.href = url;
    document.head.appendChild(link);
  },
  
  // Prefetch resources
  prefetch: (url) => {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    document.head.appendChild(link);
  },
  
  // Service worker registration
  registerServiceWorker: async (swPath = '/sw.js') => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register(swPath);
        console.log('SW registered: ', registration);
        return registration;
      } catch (error) {
        console.log('SW registration failed: ', error);
        return null;
      }
    }
    return null;
  }
};

export default {
  imageOptimization,
  componentOptimization,
  memoryOptimization,
  bundleOptimization,
  dataOptimization,
  performanceMonitoring,
  resourceOptimization
};