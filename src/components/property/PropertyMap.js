'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Home, Bath, Bed, X, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useGeolocationContext } from '@/context/GeolocationContext';
import GoogleMapsLoader from './GoogleMapsLoader';

function PropertyMapContent({ properties, isLoading, hasMore, onLoadMore }) {
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [geocodedProperties, setGeocodedProperties] = useState([]);
  const [geocodeCache, setGeocodeCache] = useState(() => {
    // Load cached geocoding results from localStorage on init
    if (typeof window !== 'undefined') {
      const cache = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('geocode_')) {
          const address = key.replace('geocode_', '');
          try {
            cache[address] = JSON.parse(localStorage.getItem(key));
          } catch (e) {
            // Invalid cache entry, ignore
          }
        }
      }
      return cache;
    }
    return {};
  });
  const [isGeocodingInProgress, setIsGeocodingInProgress] = useState(false);
  const [geocodingProgress, setGeocodingProgress] = useState(0);
  const mapRef = useRef(null);
  const { location } = useGeolocationContext();

  // Initialize Google Map
  useEffect(() => {
    if (!mapRef.current || map) return;

    // Check if Google Maps is loaded
    if (!window.google || !window.google.maps || !window.google.maps.Map) {
      console.error('Google Maps not loaded properly');
      return;
    }

    console.log('Initializing Google Map...');

    // Initialize map centered on Lagos by default
    const defaultCenter = location 
      ? { lat: location.latitude, lng: location.longitude }
      : { lat: 6.5244, lng: 3.3792 }; // Lagos

    const mapInstance = new window.google.maps.Map(mapRef.current, {
      center: defaultCenter,
      zoom: 12,
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      scaleControl: true,
      streetViewControl: false,
      fullscreenControl: true,
      styles: [
        {
          featureType: 'poi.business',
          stylers: [{ visibility: 'off' }]
        }
      ]
    });

    setMap(mapInstance);
  }, [location]);

  // Geocode addresses to coordinates with rate limiting
  const geocodeAddress = useCallback(async (address) => {
    if (!address || !window.google) return null;
    
    // Check cache first (COST SAVING: Avoid duplicate API calls)
    if (geocodeCache[address]) {
      return geocodeCache[address];
    }

    // Rate limiting: Only geocode if we haven't hit daily limit
    const today = new Date().toDateString();
    const dailyKey = `geocode_count_${today}`;
    const dailyCount = parseInt(localStorage.getItem(dailyKey) || '0');
    const DAILY_LIMIT = 100; // Adjust based on your needs

    if (dailyCount >= DAILY_LIMIT) {
      console.warn('Daily geocoding limit reached, using fallback location');
      return {
        latitude: 6.5244 + (Math.random() - 0.5) * 0.1,
        longitude: 3.3792 + (Math.random() - 0.5) * 0.1
      };
    }

    try {
      const geocoder = new window.google.maps.Geocoder();
      const result = await new Promise((resolve, reject) => {
        geocoder.geocode(
          { 
            address: `${address}, Lagos, Nigeria`,
            region: 'NG'
          },
          (results, status) => {
            if (status === 'OK' && results[0]) {
              const location = results[0].geometry.location;
              const coords = {
                latitude: location.lat(),
                longitude: location.lng()
              };
              resolve(coords);
            } else {
              resolve(null);
            }
          }
        );
      });

      // Update daily count (COST TRACKING)
      localStorage.setItem(dailyKey, (dailyCount + 1).toString());

      // Cache the result permanently (COST SAVING)
      const cacheKey = `geocode_${address}`;
      localStorage.setItem(cacheKey, JSON.stringify(result));
      
      setGeocodeCache(prev => ({
        ...prev,
        [address]: result
      }));

      return result;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  }, [geocodeCache]);

  // Geocode properties that don't have coordinates
  useEffect(() => {
    if (!map || !properties.length) return;

    const geocodeProperties = async () => {
      setIsGeocodingInProgress(true);
      setGeocodingProgress(0);
      
      const propertiesWithCoords = [];
      const totalProperties = properties.length;
      
      for (let i = 0; i < properties.length; i++) {
        const property = properties[i];
        
        // Update progress
        setGeocodingProgress(Math.round((i / totalProperties) * 100));
        
        if (property.coordinates?.latitude && property.coordinates?.longitude) {
          // Already has coordinates
          propertiesWithCoords.push(property);
        } else if (property.location) {
          // Need to geocode
          const coords = await geocodeAddress(property.location);
          if (coords) {
            propertiesWithCoords.push({
              ...property,
              coordinates: coords
            });
          } else {
            // Fallback to Lagos center with small random offset
            propertiesWithCoords.push({
              ...property,
              coordinates: {
                latitude: 6.5244 + (Math.random() - 0.5) * 0.1,
                longitude: 3.3792 + (Math.random() - 0.5) * 0.1
              }
            });
          }
        }
      }
      
      setGeocodedProperties(propertiesWithCoords);
      setIsGeocodingInProgress(false);
      setGeocodingProgress(100);
    };

    geocodeProperties();
  }, [map, properties, geocodeAddress]);

  // Force-based layout to eliminate ALL overlaps
  const forceLayoutMarkers = (properties) => {
    const adjustedProperties = properties.map(p => ({ 
      ...p, 
      coordinates: { ...p.coordinates }
    }));

    const minDistance = 0.008; // Much larger minimum distance (roughly 800m)
    const maxIterations = 50;
    const repulsionForce = 0.0001;

    // Apply force-based separation
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      let moved = false;

      for (let i = 0; i < adjustedProperties.length; i++) {
        if (!adjustedProperties[i].coordinates) continue;

        let forceX = 0;
        let forceY = 0;

        // Calculate repulsion from all other markers
        for (let j = 0; j < adjustedProperties.length; j++) {
          if (i === j || !adjustedProperties[j].coordinates) continue;

          const dx = adjustedProperties[i].coordinates.longitude - adjustedProperties[j].coordinates.longitude;
          const dy = adjustedProperties[i].coordinates.latitude - adjustedProperties[j].coordinates.latitude;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // Apply strong repulsion if too close
          if (distance < minDistance && distance > 0) {
            const force = repulsionForce * (minDistance - distance) / distance;
            forceX += dx * force;
            forceY += dy * force;
            moved = true;
          }
        }

        // Apply the force
        if (Math.abs(forceX) > 0.00001 || Math.abs(forceY) > 0.00001) {
          adjustedProperties[i].coordinates.longitude += forceX;
          adjustedProperties[i].coordinates.latitude += forceY;
        }
      }

      // If no markers moved, we're done
      if (!moved) break;
    }

    // Final pass: grid-based collision detection for stubborn overlaps
    const gridSize = minDistance / 2;
    const occupiedGrid = new Map();

    adjustedProperties.forEach((property, index) => {
      if (!property.coordinates) return;

      const gridX = Math.floor(property.coordinates.longitude / gridSize);
      const gridY = Math.floor(property.coordinates.latitude / gridSize);
      const gridKey = `${gridX},${gridY}`;

      // Check surrounding grid cells for conflicts
      let foundSpot = false;
      let attempts = 0;
      let currentGridX = gridX;
      let currentGridY = gridY;

      while (!foundSpot && attempts < 100) {
        const checkKey = `${currentGridX},${currentGridY}`;
        
        if (!occupiedGrid.has(checkKey)) {
          occupiedGrid.set(checkKey, index);
          property.coordinates.longitude = currentGridX * gridSize + (gridSize / 2);
          property.coordinates.latitude = currentGridY * gridSize + (gridSize / 2);
          foundSpot = true;
        } else {
          // Spiral outward to find empty spot
          const radius = Math.floor(attempts / 8) + 1;
          const angle = (attempts % 8) * Math.PI / 4;
          currentGridX = gridX + Math.round(Math.cos(angle) * radius);
          currentGridY = gridY + Math.round(Math.sin(angle) * radius);
          attempts++;
        }
      }
    });

    return adjustedProperties;
  };

  // Create markers for properties
  useEffect(() => {
    if (!map || !geocodedProperties.length) return;

    // Clear existing markers
    markers.forEach(marker => marker.setMap(null));

    // Apply force-based layout to eliminate overlaps
    const adjustedProperties = forceLayoutMarkers(geocodedProperties);

    // Create new markers
    const newMarkers = adjustedProperties.map((property, index) => {
      // Skip properties without coordinates
      if (!property.coordinates?.latitude || !property.coordinates?.longitude) {
        return null;
      }

      // Create marker with dynamic z-index (higher for selected)
      const marker = new window.google.maps.Marker({
        position: {
          lat: property.coordinates.latitude,
          lng: property.coordinates.longitude
        },
        map: map,
        title: property.title,
        icon: {
          url: createMarkerIcon(property),
          scaledSize: new window.google.maps.Size(100, 60),
          anchor: new window.google.maps.Point(50, 60)
        },
        zIndex: selectedProperty?.id === property.id ? 1000 : index
      });

      // Add click listener
      marker.addListener('click', () => {
        setSelectedProperty(property);
        map.panTo(marker.getPosition());
        
        // Bring clicked marker to front
        marker.setZIndex(1000);
        // Reset other markers' z-index
        newMarkers.forEach((m, i) => {
          if (m !== marker) m.setZIndex(i);
        });
      });

      // Add hover effects
      marker.addListener('mouseover', () => {
        marker.setZIndex(999);
      });

      marker.addListener('mouseout', () => {
        if (selectedProperty?.id !== property.id) {
          marker.setZIndex(index);
        }
      });

      return marker;
    }).filter(Boolean);

    setMarkers(newMarkers);

    // Adjust map bounds to show all markers
    if (newMarkers.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      newMarkers.forEach(marker => {
        bounds.extend(marker.getPosition());
      });
      map.fitBounds(bounds);
    }

    return () => {
      // Cleanup markers
      newMarkers.forEach(marker => marker.setMap(null));
    };
  }, [map, geocodedProperties, selectedProperty]);

  // Create custom marker icon with price
  const createMarkerIcon = (property) => {
    let price = 'Contact';
    let textSize = '14';
    let boxWidth = '80';
    
    if (property.price || property.displayPrice) {
      const priceValue = property.displayPrice || property.price;
      if (typeof priceValue === 'string') {
        price = priceValue.length > 12 ? priceValue.substring(0, 12) + '...' : priceValue;
      } else if (typeof priceValue === 'number') {
        price = priceValue >= 1000000 
          ? `₦${(priceValue / 1000000).toFixed(1)}M`
          : `₦${(priceValue / 1000).toFixed(0)}K`;
      }
    }

    // Adjust box width and text size based on content length
    if (price.length > 8) {
      boxWidth = '100';
      textSize = '12';
    } else if (price.length > 6) {
      boxWidth = '90';
      textSize = '13';
    }

    // Create an SVG icon with price
    const svg = `
      <svg width="${boxWidth}" height="60" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="2" dy="3" stdDeviation="2" flood-color="#000000" flood-opacity="0.4"/>
          </filter>
        </defs>
        <g>
          <!-- Background shadow -->
          <rect x="7" y="11" width="${parseInt(boxWidth) - 10}" height="36" rx="18" fill="#000000" fill-opacity="0.2"/>
          <!-- Main background -->
          <rect x="5" y="8" width="${parseInt(boxWidth) - 10}" height="36" rx="18" fill="#1e40af" stroke="#1e3a8a" stroke-width="2"/>
          <!-- Text -->
          <text x="${parseInt(boxWidth) / 2}" y="30" text-anchor="middle" fill="white" font-size="${textSize}" font-weight="bold" font-family="Arial, sans-serif">${price}</text>
          <!-- Arrow shadow -->
          <polygon points="${parseInt(boxWidth) / 2 + 1},47 ${parseInt(boxWidth) / 2 - 5},57 ${parseInt(boxWidth) / 2 + 7},57" fill="#000000" fill-opacity="0.2"/>
          <!-- Main arrow -->
          <polygon points="${parseInt(boxWidth) / 2},44 ${parseInt(boxWidth) / 2 - 6},54 ${parseInt(boxWidth) / 2 + 6},54" fill="#1e40af"/>
        </g>
      </svg>
    `;

    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  };

  // Format price display
  const formatPrice = (price) => {
    if (!price) return 'Contact for price';
    if (price >= 1000000) {
      return `₦${(price / 1000000).toFixed(1)}M`;
    }
    return `₦${price.toLocaleString()}`;
  };

  return (
    <div className="relative h-full">
      {/* Google Map Container */}
      <div ref={mapRef} className="w-full h-full min-h-[600px] lg:min-h-[700px]" />

      {/* Loading Overlay */}
      {(isLoading || isGeocodingInProgress) && (
        <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-10">
          <div className="text-center bg-white p-6 rounded-lg shadow-lg">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            {isLoading ? (
              <p className="text-gray-600">Loading properties...</p>
            ) : (
              <>
                <p className="text-gray-600 mb-2">Processing locations...</p>
                <div className="w-64 bg-gray-200 rounded-full h-2 mb-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${geocodingProgress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-500">{geocodingProgress}% complete</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Selected Property Card */}
      {selectedProperty && (
        <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white rounded-lg shadow-xl z-20 animate-slide-up">
          <div className="relative">
            {/* Close button */}
            <button
              onClick={() => setSelectedProperty(null)}
              className="absolute top-2 right-2 z-10 bg-white rounded-full p-1 shadow-md hover:shadow-lg transition-shadow"
            >
              <X size={20} />
            </button>

            {/* Property Image */}
            {selectedProperty.images && selectedProperty.images[0] && (
              <img
                src={selectedProperty.images[0].url || selectedProperty.images[0]}
                alt={selectedProperty.title}
                className="w-full h-48 object-cover rounded-t-lg"
              />
            )}

            {/* Property Details */}
            <div className="p-4">
              <h3 className="font-semibold text-lg text-gray-900 mb-1 line-clamp-1">
                {selectedProperty.title}
              </h3>
              
              <div className="flex items-center text-sm text-gray-600 mb-2">
                <MapPin size={16} className="mr-1" />
                <span className="line-clamp-1">{selectedProperty.location}</span>
              </div>

              <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                {selectedProperty.bedrooms && (
                  <div className="flex items-center">
                    <Bed size={16} className="mr-1" />
                    <span>{selectedProperty.bedrooms} Beds</span>
                  </div>
                )}
                {selectedProperty.bathrooms && (
                  <div className="flex items-center">
                    <Bath size={16} className="mr-1" />
                    <span>{selectedProperty.bathrooms} Baths</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="text-xl font-bold text-blue-600">
                  {formatPrice(selectedProperty.price)}
                  {selectedProperty.rentType && (
                    <span className="text-sm font-normal text-gray-600">
                      /{selectedProperty.rentType}
                    </span>
                  )}
                </div>
                
                <Link
                  href={`/property/${selectedProperty.slug}`}
                  className="flex items-center text-blue-600 hover:text-blue-700 font-medium text-sm"
                >
                  View Details
                  <ChevronRight size={16} className="ml-1" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Map Legend and Load More - Only show when not loading */}
      {!isLoading && !isGeocodingInProgress && (
        <>
          <div className="absolute top-4 left-4 bg-white rounded-lg shadow-md p-3 z-10">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Property Prices</h4>
            <div className="text-xs text-gray-600">
              <p>Click on markers to view details</p>
              <p className="mt-1">{geocodedProperties.length} properties shown</p>
            </div>
          </div>
          
          {/* Load More Button - Only show if there are more properties */}
          {hasMore && (
            <div className="absolute bottom-4 right-4 z-10">
              <button
                onClick={() => onLoadMore && onLoadMore()}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-xl"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Loading...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Load More Properties
                  </>
                )}
              </button>
            </div>
          )}
        </>
      )}

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
        .line-clamp-1 {
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
        }
      `}</style>
    </div>
  );
}

// Export the component wrapped with GoogleMapsLoader
export default function PropertyMap(props) {
  return (
    <GoogleMapsLoader>
      <PropertyMapContent {...props} />
    </GoogleMapsLoader>
  );
}