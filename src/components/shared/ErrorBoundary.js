'use client';
// components/shared/ErrorBoundary.js
import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import logger from '@/utils/logger';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error using our comprehensive logger (now with safe session ID handling)
    try {
      logger.error('ErrorBoundary caught an error', error, {
        errorBoundary: true,
        componentStack: errorInfo.componentStack,
        errorBoundaryName: this.props.name || 'ErrorBoundary'
      });
    } catch (logError) {
      // Fallback to console if logger fails
      console.error('ErrorBoundary caught an error (logger failed):', error, errorInfo);
      console.error('Logger error:', logError);
    }
    
    // Update state with error details
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI
      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Something went wrong
            </h2>
            <p className="text-gray-600 mb-6">
              We're sorry, but something unexpected happened. Please try refreshing the page.
            </p>
            
            {/* Show error details in development */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="text-left bg-gray-100 p-4 rounded-lg mb-4">
                <summary className="cursor-pointer font-medium text-red-600 mb-2">
                  Error Details (Development Mode)
                </summary>
                <pre className="text-sm text-red-800 whitespace-pre-wrap overflow-auto">
                  {this.state.error.toString()}
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
            
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null, errorInfo: null });
                }}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
              >
                <RefreshCw size={16} />
                Try Again
              </button>
              
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Specialized error boundary for Hub components
export const HubErrorBoundary = ({ children }) => {
  const CustomFallback = ({ error, retry }) => (
    <div className="bg-white rounded-lg shadow p-6 text-center">
      <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <AlertCircle className="w-6 h-6 text-red-600" />
      </div>
      
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        Hub Component Error
      </h3>
      
      <p className="text-gray-600 mb-4 text-sm">
        This section of the Hub encountered an error. You can try reloading or return to the dashboard.
      </p>

      <div className="flex space-x-3 justify-center">
        <button
          onClick={retry}
          className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition flex items-center"
        >
          <RefreshCw className="w-4 h-4 mr-1" />
          Retry
        </button>
        
        <button
          onClick={() => window.location.reload()}
          className="bg-gray-100 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-200 transition"
        >
          Reload Page
        </button>
      </div>
    </div>
  );

  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  );
};

// Hook for handling errors in functional components
export const useErrorHandler = () => {
  const [error, setError] = React.useState(null);

  const resetError = () => setError(null);

  const handleError = React.useCallback((error) => {
    console.error('Error caught by useErrorHandler:', error);
    setError(error);
  }, []);

  return { error, resetError, handleError };
};

export default ErrorBoundary;