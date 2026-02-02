// hooks/useGeolocation.js
import { useState, useEffect, useCallback } from 'react';

export function useGeolocation() {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [watchId, setWatchId] = useState(null);

  // Clear any existing geolocation errors when component unmounts
  // or when requesting location again
  const clearGeolocationErrors = useCallback(() => {
    setError(null);
  }, []);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return Promise.reject('Geolocation not supported');
    }

    setLoading(true);
    clearGeolocationErrors();

    return new Promise((resolve, reject) => {
      // Options for high accuracy and longer timeout
      const options = {
        enableHighAccuracy: true,
        timeout: 10000, // 10 seconds (increased from 5 seconds)
        maximumAge: 0    // Don't use cached position
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const locationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
          };
          
          console.log('Location obtained successfully:', locationData);
          setLocation(locationData);
          setLoading(false);
          resolve(locationData);
        },
        (geoError) => {
          let errorMessage;
          
          // More descriptive error messages
          switch(geoError.code) {
            case 1: // PERMISSION_DENIED
              errorMessage = 'Location access was denied. Please enable location services.';
              break;
            case 2: // POSITION_UNAVAILABLE
              errorMessage = 'Location information is unavailable. Please try again.';
              break;
            case 3: // TIMEOUT
              errorMessage = 'The request to get location timed out. Please try again.';
              break;
            default:
              errorMessage = geoError.message || 'Unknown location error occurred';
          }
          
          console.error('Geolocation error:', errorMessage, geoError);
          setError(errorMessage);
          setLoading(false);
          reject(errorMessage);
        },
        options
      );
    });
  }, [clearGeolocationErrors]);

  // Function to get current location on mount if desired
  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setLoading(true);
    clearGeolocationErrors();
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        });
        setLoading(false);
      },
      (geoError) => {
        let errorMessage;
        
        switch(geoError.code) {
          case 1: // PERMISSION_DENIED
            errorMessage = 'Location access was denied';
            break;
          case 2: // POSITION_UNAVAILABLE
            errorMessage = 'Location information is unavailable';
            break;
          case 3: // TIMEOUT
            errorMessage = 'The request to get location timed out';
            break;
          default:
            errorMessage = geoError.message || 'Unknown error occurred';
        }
        
        setError(errorMessage);
        setLoading(false);
        console.error('Error getting location:', errorMessage, geoError);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [clearGeolocationErrors]);

  // Watch location with improved error handling
  const watchLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return null;
    }

    setLoading(true);
    clearGeolocationErrors();
    
    const id = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        });
        setLoading(false);
      },
      (geoError) => {
        let errorMessage;
        
        switch(geoError.code) {
          case 1: // PERMISSION_DENIED
            errorMessage = 'Location access was denied';
            break;
          case 2: // POSITION_UNAVAILABLE
            errorMessage = 'Location information is unavailable';
            break;
          case 3: // TIMEOUT
            errorMessage = 'The request to get location timed out';
            break;
          default:
            errorMessage = geoError.message || 'Unknown error occurred';
        }
        
        setError(errorMessage);
        setLoading(false);
        console.error('Error watching location:', errorMessage, geoError);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    setWatchId(id);
    return id;
  }, [clearGeolocationErrors]);

  // Function to stop watching location changes
  const clearWatch = useCallback(() => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
  }, [watchId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  return { 
    location, 
    error, 
    loading, 
    requestLocation, 
    getCurrentLocation, 
    watchLocation,
    clearWatch,
    clearGeolocationErrors
  };
}