'use client';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { 
  componentOptimization, 
  memoryOptimization,
  dataOptimization,
  performanceMonitoring 
} from '@/utils/performance';

/**
 * Hook for debouncing values
 */
export const useDebounceValue = (value, delay = 300) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => clearTimeout(handler);
  }, [value, delay]);
  
  return debouncedValue;
};

/**
 * Hook for throttling function calls
 */
export const useThrottle = (callback, delay = 100) => {
  const throttledFn = useRef(componentOptimization.throttle(callback, delay));
  
  useEffect(() => {
    throttledFn.current = componentOptimization.throttle(callback, delay);
  }, [callback, delay]);
  
  return throttledFn.current;
};

/**
 * Hook for virtual scrolling
 */
export const useVirtualScroll = (items, itemHeight = 50, containerHeight = 400) => {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerRef, setContainerRef] = useState(null);
  
  const visibleItems = useMemo(() => {
    return componentOptimization.getVisibleItems(
      items,
      containerHeight,
      itemHeight,
      scrollTop
    );
  }, [items, containerHeight, itemHeight, scrollTop]);
  
  const handleScroll = useThrottle((e) => {
    setScrollTop(e.target.scrollTop);
  }, 16); // ~60fps
  
  useEffect(() => {
    const container = containerRef;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [containerRef, handleScroll]);
  
  return {
    containerRef: setContainerRef,
    visibleItems,
    totalHeight: visibleItems.totalHeight,
    offsetY: visibleItems.offsetY
  };
};

/**
 * Hook for caching API data
 */
export const useApiCache = (ttl = 5 * 60 * 1000) => {
  const cache = useRef(dataOptimization.createCache(ttl));
  
  const getCachedData = useCallback((key) => {
    return cache.current.get(key);
  }, []);
  
  const setCachedData = useCallback((key, data) => {
    cache.current.set(key, data);
  }, []);
  
  const clearCache = useCallback(() => {
    cache.current.clear();
  }, []);
  
  // Clear cache on unmount
  useEffect(() => {
    return () => cache.current.clear();
  }, []);
  
  return {
    get: getCachedData,
    set: setCachedData,
    clear: clearCache,
    size: () => cache.current.size()
  };
};

/**
 * Hook for request deduplication
 */
export const useRequestDeduplication = () => {
  const deduplicator = useRef(dataOptimization.createDeduplicator());
  
  const makeRequest = useCallback((key, requestFn) => {
    return deduplicator.current(key, requestFn);
  }, []);
  
  return makeRequest;
};

/**
 * Hook for batching operations
 */
export const useBatcher = (batchFn, delay = 50, maxBatchSize = 10) => {
  const batcher = useRef(dataOptimization.createBatcher(batchFn, delay, maxBatchSize));
  
  const addToBatch = useCallback((item) => {
    return batcher.current(item);
  }, []);
  
  return addToBatch;
};

/**
 * Hook for lazy loading images
 */
export const useLazyImage = (src, options = {}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef(null);
  
  useEffect(() => {
    const img = imgRef.current;
    if (!img || !src) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, ...options }
    );
    
    observer.observe(img);
    
    return () => observer.disconnect();
  }, [src, options]);
  
  useEffect(() => {
    if (isInView && src && !isLoaded) {
      const img = new Image();
      img.onload = () => setIsLoaded(true);
      img.src = src;
    }
  }, [isInView, src, isLoaded]);
  
  return {
    imgRef,
    isLoaded,
    isInView,
    src: isLoaded ? src : undefined
  };
};

/**
 * Hook for monitoring component performance
 */
export const useRenderPerformance = (componentName) => {
  const renderCount = useRef(0);
  const renderTimes = useRef([]);
  const performanceMarker = useRef(performanceMonitoring.measureRender(componentName));
  
  useEffect(() => {
    performanceMarker.current.start();
    renderCount.current += 1;
    
    return () => {
      performanceMarker.current.end();
    };
  });
  
  const getPerformanceStats = useCallback(() => {
    return {
      renderCount: renderCount.current,
      averageRenderTime: renderTimes.current.length > 0 
        ? renderTimes.current.reduce((a, b) => a + b, 0) / renderTimes.current.length
        : 0
    };
  }, []);
  
  return getPerformanceStats;
};

/**
 * Hook for intersection observer
 */
export const useIntersectionObserver = (options = {}) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [entry, setEntry] = useState(null);
  const elementRef = useRef(null);
  
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
        setEntry(entry);
      },
      options
    );
    
    observer.observe(element);
    
    return () => observer.disconnect();
  }, [options]);
  
  return {
    elementRef,
    isIntersecting,
    entry
  };
};

/**
 * Hook for optimized event listeners
 */
export const useOptimizedEventListener = (event, handler, element = window, options = {}) => {
  const savedHandler = useRef(handler);
  const { throttle = false, debounce = false, delay = 100 } = options;
  
  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);
  
  useEffect(() => {
    if (!element?.addEventListener) return;
    
    let optimizedHandler = (e) => savedHandler.current(e);
    
    if (throttle) {
      optimizedHandler = componentOptimization.throttle(optimizedHandler, delay);
    } else if (debounce) {
      optimizedHandler = componentOptimization.debounce(optimizedHandler, delay);
    }
    
    element.addEventListener(event, optimizedHandler);
    
    return () => {
      element.removeEventListener(event, optimizedHandler);
      if (optimizedHandler.cancel) {
        optimizedHandler.cancel();
      }
    };
  }, [event, element, throttle, debounce, delay]);
};

/**
 * Hook for cleanup management
 */
export const useCleanup = () => {
  const cleanupFunctions = useRef([]);
  
  const addCleanup = useCallback((cleanup) => {
    cleanupFunctions.current.push(cleanup);
  }, []);
  
  const cleanup = useCallback(() => {
    cleanupFunctions.current.forEach(fn => {
      if (typeof fn === 'function') {
        try {
          fn();
        } catch (error) {
          console.error('Cleanup function error:', error);
        }
      }
    });
    cleanupFunctions.current = [];
  }, []);
  
  useEffect(() => {
    return cleanup;
  }, [cleanup]);
  
  return addCleanup;
};

/**
 * Hook for memory usage monitoring
 */
export const useMemoryMonitor = () => {
  const [memoryInfo, setMemoryInfo] = useState(null);
  
  const updateMemoryInfo = useCallback(() => {
    const info = performanceMonitoring.getMemoryInfo();
    setMemoryInfo(info);
  }, []);
  
  useEffect(() => {
    updateMemoryInfo();
    const interval = setInterval(updateMemoryInfo, 5000); // Update every 5 seconds
    
    return () => clearInterval(interval);
  }, [updateMemoryInfo]);
  
  return memoryInfo;
};

export default {
  useDebounceValue,
  useThrottle,
  useVirtualScroll,
  useApiCache,
  useRequestDeduplication,
  useBatcher,
  useLazyImage,
  useRenderPerformance,
  useIntersectionObserver,
  useOptimizedEventListener,
  useCleanup,
  useMemoryMonitor
};