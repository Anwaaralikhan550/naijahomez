'use client';
import { useEffect, useState } from 'react';

export default function GoogleMapsLoader({ children }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!apiKey) {
      setError('Google Maps API key is not configured');
      return;
    }

    // Check if already loaded
    if (window.google && window.google.maps && window.google.maps.Map) {
      console.log('Google Maps already loaded');
      setIsLoaded(true);
      return;
    }

    // Check if script is already being loaded
    if (document.querySelector('script[src*="maps.googleapis.com"]')) {
      console.log('Google Maps script already exists, waiting for load...');
      const checkLoaded = setInterval(() => {
        if (window.google && window.google.maps && window.google.maps.Map) {
          console.log('Google Maps API ready');
          setIsLoaded(true);
          clearInterval(checkLoaded);
        }
      }, 100);
      return;
    }

    // Load the script dynamically
    console.log('Loading Google Maps script...');
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      console.log('Google Maps script loaded');
      // Wait a bit for full initialization
      setTimeout(() => {
        if (window.google && window.google.maps && window.google.maps.Map) {
          console.log('Google Maps API ready');
          setIsLoaded(true);
        } else {
          console.error('Google Maps API not ready after script load');
          setError('Google Maps failed to initialize');
        }
      }, 100);
    };

    script.onerror = () => {
      console.error('Failed to load Google Maps script');
      setError('Failed to load Google Maps');
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup if component unmounts
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [apiKey]);

  if (!apiKey || error) {
    return (
      <div className="text-center p-8 text-gray-500">
        {error || 'Map view is not available'}
      </div>
    );
  }

  return (
    <>
      {isLoaded ? children : (
        <div className="flex items-center justify-center h-full bg-gray-100">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading Google Maps...</p>
          </div>
        </div>
      )}
    </>
  );
}