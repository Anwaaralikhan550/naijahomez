'use client';
import React from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';

export const Pagination = ({ 
  currentPage, 
  totalPages, 
  totalItems,
  itemsPerPage,
  onPageChange, 
  showInfo = true,
  showQuickJump = false,
  className = '' 
}) => {
  if (totalPages <= 1) return null;

  const renderPageNumbers = () => {
    const pages = [];
    const showPages = 5; // Show 5 page numbers
    let startPage = Math.max(1, currentPage - Math.floor(showPages / 2));
    let endPage = Math.min(totalPages, startPage + showPages - 1);
    
    // Adjust start if we're near the end
    if (endPage - startPage + 1 < showPages) {
      startPage = Math.max(1, endPage - showPages + 1);
    }

    // First page + ellipsis
    if (startPage > 1) {
      pages.push(
        <button
          key={1}
          onClick={() => onPageChange(1)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
        >
          1
        </button>
      );
      
      if (startPage > 2) {
        pages.push(
          <div key="start-ellipsis" className="px-2 py-2">
            <MoreHorizontal className="w-4 h-4 text-gray-400" />
          </div>
        );
      }
    }

    // Page numbers
    for (let page = startPage; page <= endPage; page++) {
      pages.push(
        <button
          key={page}
          onClick={() => onPageChange(page)}
          className={`px-3 py-2 text-sm border rounded-md ${
            page === currentPage
              ? 'bg-blue-600 text-white border-blue-600'
              : 'border-gray-300 hover:bg-gray-50 text-gray-700'
          }`}
        >
          {page}
        </button>
      );
    }

    // Last page + ellipsis
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        pages.push(
          <div key="end-ellipsis" className="px-2 py-2">
            <MoreHorizontal className="w-4 h-4 text-gray-400" />
          </div>
        );
      }
      
      pages.push(
        <button
          key={totalPages}
          onClick={() => onPageChange(totalPages)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
        >
          {totalPages}
        </button>
      );
    }

    return pages;
  };

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0 ${className}`}>
      {showInfo && (
        <div className="text-sm text-gray-700">
          Showing <span className="font-medium">{startItem}</span> to{' '}
          <span className="font-medium">{endItem}</span> of{' '}
          <span className="font-medium">{totalItems}</span> results
        </div>
      )}

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Previous button */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={`px-3 py-2 text-sm border border-gray-300 rounded-md flex items-center ${
            currentPage === 1
              ? 'text-gray-400 cursor-not-allowed'
              : 'text-gray-700 hover:bg-gray-50'
          }`}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Previous
        </button>

        {/* Page numbers */}
        <div className="hidden sm:flex items-center gap-2">
          {renderPageNumbers()}
        </div>

        {/* Mobile page info */}
        <div className="sm:hidden px-3 py-2 text-sm text-gray-700">
          Page {currentPage} of {totalPages}
        </div>

        {/* Next button */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={`px-3 py-2 text-sm border border-gray-300 rounded-md flex items-center ${
            currentPage === totalPages
              ? 'text-gray-400 cursor-not-allowed'
              : 'text-gray-700 hover:bg-gray-50'
          }`}
        >
          Next
          <ChevronRight className="w-4 h-4 ml-1" />
        </button>
      </div>

      {showQuickJump && totalPages > 10 && (
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-700">Go to:</span>
          <input
            type="number"
            min={1}
            max={totalPages}
            className="w-16 px-2 py-1 text-sm border border-gray-300 rounded"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                const page = parseInt(e.target.value);
                if (page >= 1 && page <= totalPages) {
                  onPageChange(page);
                }
              }
            }}
            placeholder="1"
          />
        </div>
      )}
    </div>
  );
};

// Hook for pagination state management
export const usePagination = (totalItems, itemsPerPage = 10, initialPage = 1) => {
  const [currentPage, setCurrentPage] = React.useState(initialPage);
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const nextPage = () => goToPage(currentPage + 1);
  const prevPage = () => goToPage(currentPage - 1);
  const goToFirstPage = () => goToPage(1);
  const goToLastPage = () => goToPage(totalPages);

  // Calculate slice indices for array pagination
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;

  // Reset to first page when total items change significantly
  React.useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  return {
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    startIndex,
    endIndex,
    goToPage,
    nextPage,
    prevPage,
    goToFirstPage,
    goToLastPage,
    setCurrentPage,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1
  };
};

// Server-side pagination hook for API calls
export const useServerPagination = (
  fetchFunction, 
  itemsPerPage = 10, 
  dependencies = []
) => {
  const [data, setData] = React.useState([]);
  const [totalItems, setTotalItems] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  
  const pagination = usePagination(totalItems, itemsPerPage);

  const fetchData = React.useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    
    try {
      const offset = (page - 1) * itemsPerPage;
      const result = await fetchFunction({ 
        limit: itemsPerPage, 
        offset,
        page 
      });
      
      setData(result.items || result.data || []);
      setTotalItems(result.total || result.totalItems || 0);
      pagination.setCurrentPage(page);
    } catch (err) {
      setError(err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [fetchFunction, itemsPerPage, ...dependencies]);

  // Load data when page changes
  React.useEffect(() => {
    fetchData(pagination.currentPage);
  }, [pagination.currentPage]);

  // Reload data when dependencies change
  React.useEffect(() => {
    if (pagination.currentPage === 1) {
      fetchData(1);
    } else {
      pagination.goToFirstPage();
    }
  }, dependencies);

  const refresh = () => fetchData(pagination.currentPage);

  return {
    data,
    loading,
    error,
    refresh,
    pagination: {
      ...pagination,
      goToPage: (page) => {
        pagination.goToPage(page);
        fetchData(page);
      }
    }
  };
};

// Infinite scroll pagination component
export const InfiniteScrollPagination = ({ 
  hasMore, 
  loading, 
  onLoadMore,
  loader = null,
  endMessage = null,
  threshold = 100 
}) => {
  const [isVisible, setIsVisible] = React.useState(false);
  const ref = React.useRef();

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loading) {
          onLoadMore();
        }
      },
      { threshold: 0.1, rootMargin: `${threshold}px` }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loading, onLoadMore, threshold]);

  return (
    <div ref={ref} className="w-full py-4 text-center">
      {loading && (loader || (
        <div className="flex items-center justify-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-sm text-gray-600">Loading more...</span>
        </div>
      ))}
      
      {!hasMore && !loading && (endMessage || (
        <p className="text-sm text-gray-500">No more items to load</p>
      ))}
    </div>
  );
};

export default Pagination;
