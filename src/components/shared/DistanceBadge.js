'use client';
// components/shared/DistanceBadge.js
import React from 'react';
import { MapPin } from 'lucide-react';
import { useGeolocationContext } from '@/context/GeolocationContext';
import { getDistanceText } from '@/utils/locationUtils';

export default function DistanceBadge({ item, className = '' }) {
  const { nearbyEnabled } = useGeolocationContext();
  
  // Only show if nearby filter is enabled and distance exists
  if (!nearbyEnabled || item.distance === undefined) {
    return null;
  }
  
  // Determine badge color based on distance
  let badgeColor = 'bg-blue-500 text-white';
  
  if (item.matchType === 'area' || item.distance === 0) {
    badgeColor = 'bg-green-500 text-white'; // Same area
  } else if (item.distance <= 5) {
    badgeColor = 'bg-blue-500 text-white'; // Very close
  } else if (item.distance <= 15) {
    badgeColor = 'bg-indigo-500 text-white'; // Medium distance
  } else {
    badgeColor = 'bg-purple-500 text-white'; // Further away
  }
  
  return (
    <div className={`flex items-center px-2 py-1 rounded-full text-xs font-medium ${badgeColor} ${className}`}>
      <MapPin size={10} className="mr-1" />
      {item.matchType === 'area' || item.distance === 0 
        ? 'In this area' 
        : `${getDistanceText(item.distance)} away`}
    </div>
  );
}