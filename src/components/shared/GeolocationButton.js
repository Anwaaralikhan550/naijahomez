'use client';
// components/shared/GeolocationButton.js - Improved version
import React, { useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { useGeolocationContext, RADIUS_OPTIONS } from '@/context/GeolocationContext';

export default function GeolocationButton({ className = '', hideText = false }) {
  const {
    nearbyEnabled,
    toggleNearbyFilter,
    searchRadius,
    changeSearchRadius,
    locationLoading,
    isProximityLoading
  } = useGeolocationContext();
  
  const [showRadiusOptions, setShowRadiusOptions] = useState(false);

  // Handle radius change
  const handleRadiusChange = (newRadius) => {
    changeSearchRadius(newRadius);
    setShowRadiusOptions(false);
  };

  // Handle button click
  const handleButtonClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await toggleNearbyFilter();
  };

  // Handle radius toggle
  const handleRadiusToggle = (e) => {
    e.stopPropagation();
    setShowRadiusOptions(!showRadiusOptions);
  };

  // Close radius dropdown when clicking outside
  const handleClickOutside = (e) => {
    if (showRadiusOptions) {
      setShowRadiusOptions(false);
    }
  };

  // Effect to add global click handler for radius dropdown
  React.useEffect(() => {
    if (showRadiusOptions) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showRadiusOptions]);

  return (
    <div className={`relative ${className}`}>
      {/* Near Me Button */}
      <button
        onClick={handleButtonClick}
        disabled={locationLoading}
        title={nearbyEnabled ? "Disable location filter" : "Show listings near me"}
        className={`
          flex items-center gap-2 p-2 rounded-lg transition-colors
          ${nearbyEnabled 
            ? 'bg-blue-500 text-white' 
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
          ${locationLoading || isProximityLoading ? 'opacity-70 cursor-not-allowed' : ''}
        `}
      >
        {locationLoading || isProximityLoading ? (
          <>
            <Loader2 size={20} className="animate-spin" />
            {!hideText && <span>Getting location...</span>}
          </>
        ) : (
          <>
            <MapPin size={20} />
            {!hideText && <span>Near Me</span>}
            {nearbyEnabled && !hideText && (
              <span 
                onClick={handleRadiusToggle}
                className="ml-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 rounded cursor-pointer"
              >
                {searchRadius}km ▼
              </span>
            )}
          </>
        )}
      </button>

      {/* Radius Options Dropdown */}
      {showRadiusOptions && (
        <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-lg z-50 p-2 w-48">
          <div className="text-sm font-medium text-gray-700 mb-2 px-2">Select radius:</div>
          {RADIUS_OPTIONS.map(option => (
            <button
              key={option}
              onClick={(e) => {
                e.stopPropagation();
                handleRadiusChange(option);
              }}
              className={`
                w-full text-left px-3 py-2 rounded-md text-sm
                ${searchRadius === option ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50'}
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