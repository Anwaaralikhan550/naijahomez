'use client';
import React from 'react';
import { Loader2, AlertTriangle, RefreshCw, Wifi, WifiOff } from 'lucide-react';

// Loading Spinner Component
export const LoadingSpinner = ({ 
  size = 'medium', 
  className = '', 
  message = 'Loading...' 
}) => {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-6 h-6', 
    large: 'w-8 h-8',
    xlarge: 'w-12 h-12'
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <Loader2 className={`${sizeClasses[size]} animate-spin text-blue-600`} />
      {message && (
        <p className="mt-2 text-sm text-gray-600">{message}</p>
      )}
    </div>
  );
};

// Full Page Loading
export const FullPageLoading = ({ message = 'Loading...' }) => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="text-center">
      <LoadingSpinner size="xlarge" />
      <p className="mt-4 text-lg text-gray-600">{message}</p>
    </div>
  </div>
);

// Section Loading (for smaller components)
export const SectionLoading = ({ 
  message = 'Loading...', 
  height = 'h-32',
  className = '' 
}) => (
  <div className={`${height} flex items-center justify-center ${className}`}>
    <LoadingSpinner message={message} />
  </div>
);

// Error States
export const ErrorState = ({ 
  error, 
  onRetry, 
  title = 'Something went wrong',
  message,
  showDetails = false,
  className = ''
}) => {
  const defaultMessage = error?.message || 'An unexpected error occurred. Please try again.';
  
  return (
    <div className={`text-center p-6 ${className}`}>
      <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <AlertTriangle className="w-6 h-6 text-red-600" />
      </div>
      
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 mb-4 text-sm">{message || defaultMessage}</p>

      {onRetry && (
        <button
          onClick={onRetry}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center mx-auto"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </button>
      )}

      {showDetails && error && process.env.NODE_ENV === 'development' && (
        <details className="mt-4 text-left">
          <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
            Error Details (Dev Mode)
          </summary>
          <div className="mt-2 p-3 bg-gray-50 rounded text-xs text-gray-600 overflow-auto max-h-32">
            <pre className="whitespace-pre-wrap">
              {error.stack || error.toString()}
            </pre>
          </div>
        </details>
      )}
    </div>
  );
};

// Network Error State
export const NetworkErrorState = ({ onRetry, className = '' }) => (
  <div className={`text-center p-6 ${className}`}>
    <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
      <WifiOff className="w-6 h-6 text-orange-600" />
    </div>
    
    <h3 className="text-lg font-semibold text-gray-900 mb-2">Connection Problem</h3>
    <p className="text-gray-600 mb-4 text-sm">
      Unable to connect to the server. Please check your internet connection.
    </p>

    {onRetry && (
      <button
        onClick={onRetry}
        className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition flex items-center mx-auto"
      >
        <Wifi className="w-4 h-4 mr-2" />
        Retry Connection
      </button>
    )}
  </div>
);

// Empty State Component
export const EmptyState = ({ 
  title,
  message,
  actionLabel,
  onAction,
  icon: Icon,
  className = ''
}) => (
  <div className={`text-center p-8 ${className}`}>
    {Icon && (
      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <Icon className="w-6 h-6 text-gray-400" />
      </div>
    )}
    
    <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
    {message && <p className="text-gray-600 mb-4 text-sm">{message}</p>}

    {onAction && actionLabel && (
      <button
        onClick={onAction}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
      >
        {actionLabel}
      </button>
    )}
  </div>
);

// Combined Loading/Error/Success State Handler
export const AsyncStateHandler = ({ 
  loading, 
  error, 
  data, 
  onRetry, 
  loadingMessage,
  emptyMessage,
  emptyTitle = 'No data available',
  children,
  renderEmpty,
  className = ''
}) => {
  if (loading) {
    return <SectionLoading message={loadingMessage} className={className} />;
  }

  if (error) {
    // Check if it's a network error
    const isNetworkError = error.code === 'NETWORK_ERROR' || 
                           error.message?.includes('fetch') ||
                           error.message?.includes('network');
    
    if (isNetworkError) {
      return <NetworkErrorState onRetry={onRetry} className={className} />;
    }

    return (
      <ErrorState 
        error={error} 
        onRetry={onRetry} 
        showDetails={process.env.NODE_ENV === 'development'}
        className={className}
      />
    );
  }

  // Handle empty data
  if (!data || (Array.isArray(data) && data.length === 0)) {
    if (renderEmpty) {
      return renderEmpty();
    }
    return (
      <EmptyState
        title={emptyTitle}
        message={emptyMessage}
        className={className}
      />
    );
  }

  // Render children with data
  return children;
};

// Hub-specific loading states
export const HubComponentWrapper = ({ 
  children, 
  loading, 
  error, 
  onRetry,
  title = 'Hub Component' 
}) => (
  <div className="bg-white rounded-lg shadow">
    {loading && (
      <div className="p-6">
        <SectionLoading message={`Loading ${title.toLowerCase()}...`} />
      </div>
    )}
    
    {error && !loading && (
      <div className="p-6">
        <ErrorState
          title={`Failed to load ${title.toLowerCase()}`}
          error={error}
          onRetry={onRetry}
          showDetails={process.env.NODE_ENV === 'development'}
        />
      </div>
    )}
    
    {!loading && !error && children}
  </div>
);

// Hook for managing async states
export const useAsyncState = (initialLoading = false) => {
  const [loading, setLoading] = React.useState(initialLoading);
  const [error, setError] = React.useState(null);

  const execute = React.useCallback(async (asyncFunction) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await asyncFunction();
      return result;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = React.useCallback(() => {
    setLoading(false);
    setError(null);
  }, []);

  return {
    loading,
    error,
    execute,
    reset,
    setLoading,
    setError
  };
};