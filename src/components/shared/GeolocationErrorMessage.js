import React from 'react';
import { AlertTriangle, MapPin, Settings } from 'lucide-react';

export default function GeolocationErrorMessage({ error, onRetry, onDismiss }) {
  // Determine more user-friendly error message based on error type
  const getErrorMessage = () => {
    if (!error) return null;
    
    if (error.includes('denied')) {
      return {
        title: 'Location access blocked',
        message: 'You need to allow location access to use nearby features',
        actionText: 'How to enable location'
      };
    } else if (error.includes('unavailable')) {
      return {
        title: 'Location unavailable',
        message: 'We couldn\'t determine your location at this time',
        actionText: 'Try again'
      };
    } else if (error.includes('timeout')) {
      return {
        title: 'Location request timed out',
        message: 'It took too long to get your location',
        actionText: 'Try again'
      };
    } else {
      return {
        title: 'Location error',
        message: error || 'There was a problem accessing your location',
        actionText: 'Try again'
      };
    }
  };

  const errorDetails = getErrorMessage();
  if (!errorDetails) return null;

  // Instructions based on common mobile browsers
  const showInstructions = () => {
    if (error.includes('denied')) {
      return (
        <div className="mt-4 text-sm text-left">
          <h4 className="font-semibold text-gray-800 mb-2">How to enable location:</h4>
          <div className="space-y-3">
            <div>
              <p className="font-medium">iOS (Safari):</p>
              <ol className="list-decimal ml-5 text-gray-600">
                <li>Go to Settings → Safari → Privacy & Security</li>
                <li>Enable "Location Services" and "Location" for Safari</li>
                <li>Refresh this page</li>
              </ol>
            </div>
            <div>
              <p className="font-medium">Android (Chrome):</p>
              <ol className="list-decimal ml-5 text-gray-600">
                <li>Tap the lock icon in the address bar</li>
                <li>Select "Site settings"</li>
                <li>Enable "Location"</li>
                <li>Refresh this page</li>
              </ol>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900 bg-opacity-50">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-red-50 p-4 flex items-start gap-3">
          <div className="bg-red-100 rounded-full p-2 mt-1">
            <AlertTriangle className="text-red-500 w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-red-700">{errorDetails.title}</h3>
            <p className="text-red-600 mt-1">{errorDetails.message}</p>
          </div>
        </div>
        
        {showInstructions()}
        
        <div className="p-4 bg-white flex flex-col sm:flex-row justify-end gap-3">
          <button
            onClick={onDismiss}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
          >
            Cancel
          </button>
          
          <button
            onClick={error.includes('denied') ? onDismiss : onRetry}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium text-sm flex items-center justify-center gap-2"
          >
            {error.includes('denied') ? (
              <>
                <Settings className="w-4 h-4" />
                <span>Understood</span>
              </>
            ) : (
              <>
                <MapPin className="w-4 h-4" />
                <span>Try Again</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}