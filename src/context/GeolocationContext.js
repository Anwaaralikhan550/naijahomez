'use client';
// contexts/GeolocationContext.js - Improved version
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useGeolocation } from '@/hooks/useGeolocation';
import GeolocationErrorMessage from '@/components/shared/GeolocationErrorMessage';

// Create the context
const GeolocationContext = createContext(null);

// Radius options for the proximity filter
export const RADIUS_OPTIONS = [5, 10, 20, 30, 50];

export function GeolocationProvider({ children }) {
  // Get location functionality from hook
  const { 
    location, 
    error: locationError,
    loading: locationLoading,
    requestLocation,
    clearGeolocationErrors
  } = useGeolocation();

  // State for the geolocation filter
  const [nearbyEnabled, setNearbyEnabled] = useState(false);
  const [searchRadius, setSearchRadius] = useState(20); // Default to 20km
  const [isProximityLoading, setIsProximityLoading] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  
  // Store last used location to avoid unnecessary lookups
  const [lastLocation, setLastLocation] = useState(null);

  // Show error modal when location error occurs
  useEffect(() => {
    if (locationError) {
      setShowErrorModal(true);
    }
  }, [locationError]);

  // Persist preferences in localStorage
  useEffect(() => {
    // Try to load preferences from localStorage
    try {
      const savedRadius = localStorage.getItem('geo-radius');
      if (savedRadius) {
        setSearchRadius(parseInt(savedRadius, 10));
      }
    } catch (e) {
      console.warn('Error loading geo preferences:', e);
    }
  }, []);

  // Save preferences when they change
  useEffect(() => {
    try {
      localStorage.setItem('geo-radius', searchRadius.toString());
    } catch (e) {
      console.warn('Error saving geo preferences:', e);
    }
  }, [searchRadius]);

  // Update last location when location changes
  useEffect(() => {
    if (location) {
      setLastLocation(location);
      
      // If we were waiting for location and now have it, complete the proximity loading
      if (isProximityLoading) {
        setIsProximityLoading(false);
      }
    }
  }, [location, isProximityLoading]);

  // Toggle the nearby filter
  const toggleNearbyFilter = async () => {
    if (locationLoading) return;
    
    // If turning off, just update state
    if (nearbyEnabled) {
      setNearbyEnabled(false);
      return;
    }
    
    // If turning on, request location if needed
    if (!location && !lastLocation) {
      setIsProximityLoading(true);
      try {
        await requestLocation();
      } catch (error) {
        // Handle location request error
        setIsProximityLoading(false);
        return;
      }
    } else {
      // We already have location, so skip loading state
      setIsProximityLoading(false);
    }
    
    // Enable the filter
    setNearbyEnabled(true);
  };

  // Change the search radius
  const changeSearchRadius = (radius) => {
    if (RADIUS_OPTIONS.includes(radius)) {
      setSearchRadius(radius);
    }
  };

  // Reset all geolocation settings
  const resetGeolocation = () => {
    setNearbyEnabled(false);
    setSearchRadius(20);
    clearGeolocationErrors();
  };

  // Handle error modal retry
  const handleErrorRetry = () => {
    clearGeolocationErrors();
    setShowErrorModal(false);
    requestLocation();
  };

  // Handle error modal dismiss
  const handleErrorDismiss = () => {
    setShowErrorModal(false);
    if (nearbyEnabled) {
      setNearbyEnabled(false);
    }
  };

  // The context value that will be provided
  const contextValue = {
    // Location state
    location: location || lastLocation,
    locationError,
    locationLoading,
    isProximityLoading,
    
    // Filter state
    nearbyEnabled,
    searchRadius,
    
    // Actions
    toggleNearbyFilter,
    changeSearchRadius,
    resetGeolocation,
    requestLocation
  };

  return (
    <GeolocationContext.Provider value={contextValue}>
      {children}
      
      {/* Error Modal */}
      {showErrorModal && locationError && (
        <GeolocationErrorMessage 
          error={locationError}
          onRetry={handleErrorRetry}
          onDismiss={handleErrorDismiss}
        />
      )}
    </GeolocationContext.Provider>
  );
}

// Hook to use the geolocation context
export function useGeolocationContext() {
  const context = useContext(GeolocationContext);
  if (!context) {
    throw new Error('useGeolocationContext must be used within a GeolocationProvider');
  }
  return context;
}