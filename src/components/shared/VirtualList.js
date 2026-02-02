'use client';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useVirtualScroll, useOptimizedEventListener } from '@/hooks/usePerformance';

const VirtualList = ({
  items = [],
  itemHeight = 50,
  containerHeight = 400,
  renderItem,
  className = '',
  overscan = 5,
  onScroll,
  ...props
}) => {
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  
  // Calculate visible items with overscan
  const { startIndex, endIndex, totalHeight, offsetY } = useMemo(() => {
    const containerEl = containerRef.current;
    if (!containerEl || items.length === 0) {
      return { startIndex: 0, endIndex: 0, totalHeight: 0, offsetY: 0 };
    }
    
    const viewportHeight = containerHeight;
    const start = Math.floor(scrollTop / itemHeight);
    const visibleCount = Math.ceil(viewportHeight / itemHeight);
    
    const startWithOverscan = Math.max(0, start - overscan);
    const endWithOverscan = Math.min(items.length, start + visibleCount + overscan);
    
    return {
      startIndex: startWithOverscan,
      endIndex: endWithOverscan,
      totalHeight: items.length * itemHeight,
      offsetY: startWithOverscan * itemHeight
    };
  }, [items.length, itemHeight, containerHeight, scrollTop, overscan]);
  
  // Optimized scroll handler
  const handleScroll = useCallback((e) => {
    const scrollTop = e.target.scrollTop;
    setScrollTop(scrollTop);
    onScroll?.(e, { scrollTop, startIndex, endIndex });
  }, [onScroll, startIndex, endIndex]);
  
  // Use optimized event listener
  useOptimizedEventListener('scroll', handleScroll, containerRef.current, {
    throttle: true,
    delay: 16 // ~60fps
  });
  
  // Get visible items
  const visibleItems = useMemo(() => {
    return items.slice(startIndex, endIndex);
  }, [items, startIndex, endIndex]);
  
  // Render visible items
  const renderedItems = useMemo(() => {
    return visibleItems.map((item, index) => {
      const actualIndex = startIndex + index;
      const itemStyle = {
        position: 'absolute',
        top: actualIndex * itemHeight,
        left: 0,
        right: 0,
        height: itemHeight
      };
      
      return (
        <div key={actualIndex} style={itemStyle}>
          {renderItem(item, actualIndex)}
        </div>
      );
    });
  }, [visibleItems, startIndex, itemHeight, renderItem]);
  
  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      {...props}
    >
      {/* Virtual container that maintains total height */}
      <div style={{ height: totalHeight, position: 'relative' }}>
        {/* Spacer to maintain scroll position */}
        <div style={{ height: offsetY }} />
        
        {/* Rendered items */}
        {renderedItems}
      </div>
    </div>
  );
};

// Higher-order component for memoizing list items
export const VirtualListItem = React.memo(({ children, ...props }) => {
  return <div {...props}>{children}</div>;
});

// Hook for managing virtual list state
export const useVirtualList = (items, itemHeight, containerHeight) => {
  const [scrollTop, setScrollTop] = useState(0);
  
  const visibleRange = useMemo(() => {
    const start = Math.floor(scrollTop / itemHeight);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const end = Math.min(items.length, start + visibleCount);
    
    return { start, end, visibleCount };
  }, [scrollTop, itemHeight, containerHeight, items.length]);
  
  const scrollToIndex = useCallback((index, behavior = 'smooth') => {
    const scrollPosition = index * itemHeight;
    setScrollTop(scrollPosition);
    
    return scrollPosition;
  }, [itemHeight]);
  
  const scrollToTop = useCallback((behavior = 'smooth') => {
    setScrollTop(0);
  }, []);
  
  const scrollToBottom = useCallback((behavior = 'smooth') => {
    const maxScroll = Math.max(0, items.length * itemHeight - containerHeight);
    setScrollTop(maxScroll);
  }, [items.length, itemHeight, containerHeight]);
  
  return {
    scrollTop,
    setScrollTop,
    visibleRange,
    scrollToIndex,
    scrollToTop,
    scrollToBottom
  };
};

// Grid virtualization component
export const VirtualGrid = ({
  items = [],
  itemWidth = 200,
  itemHeight = 200,
  containerWidth = 800,
  containerHeight = 400,
  renderItem,
  className = '',
  gap = 16,
  overscan = 5,
  ...props
}) => {
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  
  const { columnsPerRow, totalRows } = useMemo(() => {
    const availableWidth = containerWidth - gap;
    const columns = Math.floor(availableWidth / (itemWidth + gap));
    const rows = Math.ceil(items.length / columns);
    
    return {
      columnsPerRow: Math.max(1, columns),
      totalRows: rows
    };
  }, [containerWidth, itemWidth, gap, items.length]);
  
  const { startRow, endRow, totalHeight } = useMemo(() => {
    const rowHeight = itemHeight + gap;
    const viewportHeight = containerHeight;
    
    const start = Math.floor(scrollTop / rowHeight);
    const visibleRows = Math.ceil(viewportHeight / rowHeight);
    
    const startWithOverscan = Math.max(0, start - overscan);
    const endWithOverscan = Math.min(totalRows, start + visibleRows + overscan);
    
    return {
      startRow: startWithOverscan,
      endRow: endWithOverscan,
      totalHeight: totalRows * rowHeight
    };
  }, [scrollTop, itemHeight, gap, containerHeight, totalRows, overscan]);
  
  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, []);
  
  useOptimizedEventListener('scroll', handleScroll, containerRef.current, {
    throttle: true,
    delay: 16
  });
  
  const renderedItems = useMemo(() => {
    const items_to_render = [];
    
    for (let row = startRow; row < endRow; row++) {
      for (let col = 0; col < columnsPerRow; col++) {
        const index = row * columnsPerRow + col;
        if (index >= items.length) break;
        
        const item = items[index];
        const x = col * (itemWidth + gap) + gap;
        const y = row * (itemHeight + gap) + gap;
        
        items_to_render.push(
          <div
            key={index}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: itemWidth,
              height: itemHeight
            }}
          >
            {renderItem(item, index)}
          </div>
        );
      }
    }
    
    return items_to_render;
  }, [items, startRow, endRow, columnsPerRow, itemWidth, itemHeight, gap, renderItem]);
  
  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ width: containerWidth, height: containerHeight }}
      {...props}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {renderedItems}
      </div>
    </div>
  );
};

export default VirtualList;