'use client';
// utils/withProximityFilter.js
import React, { useState, useEffect } from 'react';
import { useGeolocationContext } from '@/context/GeolocationContext';
import { filterByProximity } from '@/utils/locationUtils';
import { Loader2 } from 'lucide-react';

/**
 * Higher-order component to add proximity filtering to any component that displays listings
 * @param {React.Component} WrappedComponent - The component to wrap
 * @returns {React.Component} - Enhanced component with proximity filtering
 */
export function withProximityFilter(WrappedComponent) {
  return function WithProximityFilter(props) {
    const { 
      data,
      isLoading: isDataLoading,
      ...otherProps
    } = props;
    
    const { 
      nearbyEnabled,
      location,
      searchRadius
    } = useGeolocationContext();
    
    const [filteredData, setFilteredData] = useState(data || []);
    const [isFiltering, setIsFiltering] = useState(false);
    
    // Apply proximity filter when location, radius or nearby flag changes
    useEffect(() => {
      const applyProximityFilter = async () => {
        // If data is empty or the component is still loading its initial data, don't filter yet
        if (!data || data.length === 0) {
          setFilteredData([]);
          return;
        }
        
        // IMPORTANT FIX: If proximity filter is disabled, use original data immediately
        // This ensures listings show up even when the "Near Me" button is not enabled
        if (!nearbyEnabled) {
          setFilteredData(data);
          return;
        }
        
        // Only if nearby filter is enabled AND we have location, do proximity filtering
        if (nearbyEnabled && location) {
          setIsFiltering(true);
          try {
            const nearbyResults = await filterByProximity(data, location, searchRadius);
            setFilteredData(nearbyResults);
          } catch (error) {
            console.error('Proximity filtering error:', error);
            // Fallback to original data on error
            setFilteredData(data);
          } finally {
            setIsFiltering(false);
          }
        } else if (nearbyEnabled && !location) {
          // If nearby filter is enabled but no location yet, keep current data
          // but don't reset to prevent flickering while waiting for location
        } else {
          // Default case - use original data
          setFilteredData(data);
        }
      };
      
      applyProximityFilter();
    }, [data, nearbyEnabled, location, searchRadius]);
    
    // Show loading indicator only when actively filtering
    // Not when initially loading or when not using proximity filter
    if (isDataLoading) {
      return (
        <WrappedComponent
          {...otherProps}
          data={[]}
          isLoading={true}
        />
      );
    }
    
    if (isFiltering) {
      return (
        <>
          <div className="max-w-6xl mx-auto my-4 px-4">
            <div className="flex items-center justify-center p-4 bg-blue-50 rounded-lg">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500 mr-2" />
              <span className="text-blue-700 font-medium">
                Finding listings within {searchRadius}km of your location...
              </span>
            </div>
          </div>
          <WrappedComponent
            {...otherProps}
            data={[]}
            isLoading={true}
          />
        </>
      );
    }
    
    // Render wrapped component with filtered data or original data based on state
    return (
      <WrappedComponent
        {...otherProps}
        data={filteredData}
        isLoading={false}
        isProximityFiltered={nearbyEnabled}
      />
    );
  };
}