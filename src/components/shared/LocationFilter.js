// components/shared/LocationFilter.js
import React, { useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';

export default function LocationFilter({ 
  nearbyOnly, 
  setNearbyOnly, 
  onLocationChange,
  radius = 20,
  setRadius 
}) {
  const { 
    location, 
    error: locationError, 
    loading: locationLoading, 
    requestLocation 
  } = useGeolocation();
  
  const [showRadiusOptions, setShowRadiusOptions] = useState(false);

  // Options for radius selection
  const radiusOptions = [5, 10, 20, 30, 50];

  // Toggle nearby filter
  const toggleNearbyFilter = async () => {
    if (locationLoading) return;
    
    if (nearbyOnly) {
      setNearbyOnly(false);
      onLocationChange(false);
      return;
    }

    if (!location) {
      try {
        await requestLocation();
      } catch (error) {
        return;
      }
    }
    
    setNearbyOnly(true);
    onLocationChange(true);
  };

  // Handle radius change
  const handleRadiusChange = (newRadius) => {
    setRadius(newRadius);
    if (nearbyOnly) {
      onLocationChange(true, newRadius);
    }
    setShowRadiusOptions(false);
  };

  return (
    <div className="relative">
      {/* Near Me Button */}
      <button
        onClick={toggleNearbyFilter}
        disabled={locationLoading}
        title={nearbyOnly ? "Disable location filter" : "Show listings near me"}
        className={`
          flex items-center gap-2 p-2 rounded-lg transition-colors
          ${nearbyOnly 
            ? 'bg-blue-500 text-white' 
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
          ${locationLoading ? 'opacity-70 cursor-not-allowed' : ''}
        `}
      >
        {locationLoading ? (
          <>
            <Loader2 size={20} className="animate-spin" />
            <span>Getting location...</span>
          </>
        ) : (
          <>
            <MapPin size={20} />
            <span>Near Me</span>
            {nearbyOnly && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowRadiusOptions(!showRadiusOptions);
                }}
                className="ml-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 rounded"
              >
                {radius}km ▼
              </button>
            )}
          </>
        )}
      </button>

      {/* Error Message */}
      {locationError && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-red-50 text-red-600 p-2 text-sm rounded-lg shadow-lg z-50">
          <p>Error: {locationError}</p>
          <p>Please enable location access in your browser.</p>
        </div>
      )}

      {/* Radius Options Dropdown */}
      {showRadiusOptions && (
        <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-lg z-50 p-2 w-48">
          <div className="text-sm font-medium text-gray-700 mb-2 px-2">Select radius:</div>
          {radiusOptions.map(option => (
            <button
              key={option}
              onClick={() => handleRadiusChange(option)}
              className={`
                w-full text-left px-3 py-2 rounded-md text-sm
                ${radius === option ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50'}
              `}
            >
              {option} kilometers
            </button>
          ))}
        </div>
      )}
    </div>
  );
}