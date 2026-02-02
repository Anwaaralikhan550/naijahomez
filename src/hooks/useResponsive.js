'use client';
import { useState, useEffect, useCallback } from 'react';
import { isMobile, isTablet, isTouchDevice, getViewport } from '@/utils/mobile';

/**
 * Hook for responsive design and mobile detection
 */
export const useResponsive = () => {
  const [screenSize, setScreenSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0
  });
  
  const [deviceType, setDeviceType] = useState({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isTouchDevice: false
  });

  const updateScreenSize = useCallback(() => {
    const { width, height } = getViewport();
    setScreenSize({ width, height });
    
    setDeviceType({
      isMobile: isMobile(),
      isTablet: isTablet(),
      isDesktop: !isMobile() && !isTablet(),
      isTouchDevice: isTouchDevice()
    });
  }, []);

  useEffect(() => {
    updateScreenSize();
    
    const debouncedResize = () => {
      clearTimeout(window.resizeTimeout);
      window.resizeTimeout = setTimeout(updateScreenSize, 150);
    };

    window.addEventListener('resize', debouncedResize);
    window.addEventListener('orientationchange', updateScreenSize);

    return () => {
      window.removeEventListener('resize', debouncedResize);
      window.removeEventListener('orientationchange', updateScreenSize);
      clearTimeout(window.resizeTimeout);
    };
  }, [updateScreenSize]);

  // Breakpoint utilities
  const breakpoints = {
    sm: screenSize.width >= 640,
    md: screenSize.width >= 768,
    lg: screenSize.width >= 1024,
    xl: screenSize.width >= 1280,
    '2xl': screenSize.width >= 1536
  };

  const getBreakpoint = () => {
    if (screenSize.width < 640) return 'xs';
    if (screenSize.width < 768) return 'sm';
    if (screenSize.width < 1024) return 'md';
    if (screenSize.width < 1280) return 'lg';
    if (screenSize.width < 1536) return 'xl';
    return '2xl';
  };

  return {
    screenSize,
    ...deviceType,
    breakpoints,
    currentBreakpoint: getBreakpoint(),
    isSmallScreen: screenSize.width < 768,
    isMediumScreen: screenSize.width >= 768 && screenSize.width < 1024,
    isLargeScreen: screenSize.width >= 1024
  };
};

/**
 * Hook for managing mobile navigation state
 */
export const useMobileNavigation = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { isMobile } = useResponsive();

  const openMenu = useCallback(() => {
    setIsMenuOpen(true);
    if (typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden';
    }
  }, []);

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
    }
  }, []);

  const toggleMenu = useCallback(() => {
    if (isMenuOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  }, [isMenuOpen, closeMenu, openMenu]);

  // Auto-close menu when screen size changes to desktop
  useEffect(() => {
    if (!isMobile && isMenuOpen) {
      closeMenu();
    }
  }, [isMobile, isMenuOpen, closeMenu]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' && isMenuOpen) {
        closeMenu();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isMenuOpen, closeMenu]);

  return {
    isMenuOpen,
    openMenu,
    closeMenu,
    toggleMenu
  };
};

/**
 * Hook for handling virtual keyboard on mobile
 */
export const useVirtualKeyboard = () => {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const { isMobile } = useResponsive();

  useEffect(() => {
    if (!isMobile || typeof window === 'undefined' || !('visualViewport' in window)) {
      return;
    }

    const viewport = window.visualViewport;
    
    const handleResize = () => {
      const height = window.innerHeight - viewport.height;
      setKeyboardHeight(height);
      setIsKeyboardOpen(height > 100); // Assume keyboard is open if viewport shrinks by more than 100px
    };

    viewport.addEventListener('resize', handleResize);
    
    return () => {
      viewport.removeEventListener('resize', handleResize);
    };
  }, [isMobile]);

  return {
    keyboardHeight,
    isKeyboardOpen,
    adjustmentStyle: {
      paddingBottom: isKeyboardOpen ? `${keyboardHeight}px` : '0px'
    }
  };
};

/**
 * Hook for mobile-optimized touch gestures
 */
export const useTouchGestures = (callbacks = {}) => {
  const [touchStart, setTouchStart] = useState({ x: 0, y: 0, time: 0 });
  const [isSwiping, setIsSwiping] = useState(false);

  const handleTouchStart = useCallback((event) => {
    const touch = event.touches[0];
    setTouchStart({
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    });
    setIsSwiping(false);
  }, []);

  const handleTouchMove = useCallback((event) => {
    if (!touchStart.time) return;
    
    const touch = event.touches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;
    
    // Detect if user is swiping (moved more than 10px)
    if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
      setIsSwiping(true);
    }
  }, [touchStart]);

  const handleTouchEnd = useCallback((event) => {
    if (!touchStart.time) return;
    
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;
    const deltaTime = Date.now() - touchStart.time;
    
    // Reset touch start
    setTouchStart({ x: 0, y: 0, time: 0 });
    
    const minSwipeDistance = 50;
    const maxSwipeTime = 300;
    
    if (deltaTime > maxSwipeTime) return;
    
    // Horizontal swipes
    if (Math.abs(deltaX) > minSwipeDistance && Math.abs(deltaY) < 100) {
      if (deltaX > 0 && callbacks.onSwipeRight) {
        callbacks.onSwipeRight();
      } else if (deltaX < 0 && callbacks.onSwipeLeft) {
        callbacks.onSwipeLeft();
      }
    }
    
    // Vertical swipes
    if (Math.abs(deltaY) > minSwipeDistance && Math.abs(deltaX) < 100) {
      if (deltaY > 0 && callbacks.onSwipeDown) {
        callbacks.onSwipeDown();
      } else if (deltaY < 0 && callbacks.onSwipeUp) {
        callbacks.onSwipeUp();
      }
    }
    
    // Tap (if not swiping and quick touch)
    if (!isSwiping && deltaTime < 200 && callbacks.onTap) {
      callbacks.onTap();
    }
    
    setIsSwiping(false);
  }, [touchStart, isSwiping, callbacks]);

  return {
    touchHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd
    },
    isSwiping
  };
};

export default useResponsive;