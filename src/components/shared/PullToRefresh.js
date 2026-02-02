'use client';
import React, { useState, useRef, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';

const PullToRefresh = ({ 
  onRefresh, 
  children, 
  className = '',
  refreshThreshold = 80,
  disabled = false 
}) => {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef(null);
  const startY = useRef(0);
  const currentY = useRef(0);

  // Handle touch start
  const handleTouchStart = (e) => {
    if (disabled) return;
    
    const container = containerRef.current;
    if (container && container.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  };

  // Handle touch move
  const handleTouchMove = (e) => {
    if (!isPulling || disabled) return;

    currentY.current = e.touches[0].clientY;
    const pullDistance = Math.max(0, currentY.current - startY.current);
    
    if (pullDistance > 0) {
      // Prevent default scrolling when pulling down
      e.preventDefault();
      setPullDistance(Math.min(pullDistance, refreshThreshold + 20));
    }
  };

  // Handle touch end
  const handleTouchEnd = async () => {
    if (!isPulling || disabled) return;

    setIsPulling(false);

    if (pullDistance >= refreshThreshold && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } catch (error) {
        console.error('Refresh error:', error);
      } finally {
        setIsRefreshing(false);
      }
    }

    setPullDistance(0);
  };

  // Mouse events for desktop testing
  const handleMouseDown = (e) => {
    if (disabled) return;
    
    const container = containerRef.current;
    if (container && container.scrollTop === 0) {
      startY.current = e.clientY;
      setIsPulling(true);
    }
  };

  const handleMouseMove = (e) => {
    if (!isPulling || disabled) return;

    currentY.current = e.clientY;
    const pullDistance = Math.max(0, currentY.current - startY.current);
    setPullDistance(Math.min(pullDistance, refreshThreshold + 20));
  };

  const handleMouseUp = async () => {
    if (!isPulling || disabled) return;

    setIsPulling(false);

    if (pullDistance >= refreshThreshold && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } catch (error) {
        console.error('Refresh error:', error);
      } finally {
        setIsRefreshing(false);
      }
    }

    setPullDistance(0);
  };

  // Add mouse event listeners
  useEffect(() => {
    if (isPulling) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isPulling, pullDistance, refreshThreshold, isRefreshing]);

  const refreshIndicatorOpacity = Math.min(pullDistance / refreshThreshold, 1);
  const refreshIconRotation = (pullDistance / refreshThreshold) * 180;
  const shouldTrigger = pullDistance >= refreshThreshold;

  return (
    <div
      ref={containerRef}
      className={`relative overflow-auto ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
    >
      {/* Pull to refresh indicator */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-center z-10 transition-all duration-200"
        style={{
          height: Math.max(0, pullDistance),
          opacity: refreshIndicatorOpacity,
          transform: `translateY(${Math.max(-50, pullDistance - 50)}px)`
        }}
      >
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${
          shouldTrigger 
            ? 'bg-green-100 text-green-600' 
            : 'bg-gray-100 text-gray-600'
        }`}>
          <RotateCcw 
            className={`w-4 h-4 transition-transform duration-200 ${
              isRefreshing ? 'animate-spin' : ''
            }`}
            style={{ 
              transform: `rotate(${refreshIconRotation}deg)` 
            }}
          />
          <span className="text-sm font-medium">
            {isRefreshing 
              ? 'Refreshing...' 
              : shouldTrigger 
                ? 'Release to refresh' 
                : 'Pull to refresh'
            }
          </span>
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: isPulling ? 'none' : 'transform 0.2s ease-out'
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;