'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { MapPin, Bed, Bath, Filter, Search, Loader2, X, Home, Tag, AlertCircle } from 'lucide-react';
import apiService from '@/services/api';
import { slugify } from '@/utils/slugify';
import { useGeolocationContext } from '@/context/GeolocationContext';
import { useAuth } from '@/context/AuthContext';
import DistanceBadge from '@/components/shared/DistanceBadge';
import PropertyFilters from '@/components/property/PropertyFilters';
import { useDebounce } from '@/hooks/useDebounce';
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import ViewToggle from './ViewToggle';
import PropertyMap from './PropertyMap';

// Define property types
const propertyTypes = [
  { value: '', label: 'All Types' },
  { value: 'house', label: 'House' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'land', label: 'Land' },
  { value: 'commercial', label: 'Commercial' }
];

// Define listing types
const listingTypes = [
  { value: '', label: 'All Listings' },
  { value: 'rent', label: 'For Rent' },
  { value: 'sale', label: 'For Sale' }
];

// Estimated offline inventory split between listing types
const TOTAL_OFFLINE_PROPERTY_COUNT = 65000;
const OFFLINE_DISTRIBUTION = {
  rent: 0.52,
  sale: 0.48,
};

const getOfflineCount = (listingType) => {
  if (listingType === 'rent' || listingType === 'sale') {
    return Math.round(TOTAL_OFFLINE_PROPERTY_COUNT * OFFLINE_DISTRIBUTION[listingType]);
  }
  return TOTAL_OFFLINE_PROPERTY_COUNT;
};

const PropertyListings = React.memo(function PropertyListings() {
  // Context hooks
  const { nearbyEnabled, searchRadius, location } = useGeolocationContext();
  const { user } = useAuth();
  
  // State management
  const [properties, setProperties] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0); // Total properties in Firestore
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'map'
  const [filters, setFilters] = useState({
    minPrice: '',
    maxPrice: '',
    bedrooms: '',
    bathrooms: '',
    location: '',
    propertyType: '',
    listingType: '',
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });
  
  // Debounced search query and filters
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const debouncedFilters = useDebounce(filters, 800);
  

  // Load properties when filters change
  useEffect(() => {
    loadProperties(true);
  }, [debouncedFilters, debouncedSearchQuery]);

  // Function to format price input with commas
  const formatPrice = (value) => {
    if (!value) return '';
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  // Function to parse price input by removing commas
  const parsePrice = (value) => {
    if (!value) return '';
    return value.toString().replace(/,/g, '');
  };

  const loadProperties = useCallback(async (reset = false) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Build API parameters with authentication
      // Use higher limit for map view to show more properties
      const isMapView = viewMode === 'map';
      const params = {
        page: reset ? 1 : currentPage,
        limit: isMapView ? 50 : 12, // 50 for map, 12 for list
        search: debouncedSearchQuery,
        minPrice: debouncedFilters.minPrice || undefined,
        maxPrice: debouncedFilters.maxPrice || undefined,
        bedrooms: debouncedFilters.bedrooms || undefined,
        bathrooms: debouncedFilters.bathrooms || undefined,
        location: debouncedFilters.location || undefined,
        propertyType: debouncedFilters.propertyType || undefined,
        listingType: debouncedFilters.listingType || undefined,
        sortBy: debouncedFilters.sortBy,
        sortOrder: debouncedFilters.sortOrder,
        // Add proximity parameters if nearby is enabled
        ...(nearbyEnabled && location && {
          lat: location.latitude,
          lng: location.longitude,
          radius: searchRadius
        })
      };
      
      // Remove undefined values
      Object.keys(params).forEach(key => 
        params[key] === undefined && delete params[key]
      );
      
      // Fetch from API (authentication handled by session cookies)
      const response = await apiService.getProperties(params);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to load properties');
      }
      
      const { data, pagination } = response;
      
      // Filter out properties without images and normalize price data
      const validProperties = data.filter(
        property => property.imageUrls && property.imageUrls.length > 0
      ).map(property => ({
        ...property,
        // Normalize price field - use consistent pricing
        displayPrice: property.rate || property.price || 'Contact for price',
        priceValue: property.priceNumeric || extractPriceValue(property) || 0,
        isForRent: isPropertyForRent(property)
      }));
      
      // Update state
      if (reset) {
        setProperties(validProperties);
        setCurrentPage(1);
      } else {
        setProperties(prev => [...prev, ...validProperties]);
      }

      setTotalCount(pagination.total); // Set the total count from API
      setTotalPages(pagination.totalPages);
      setHasMore(pagination.hasMore);

    } catch (error) {
      console.error('Error loading properties:', error);
      setError(error.message || 'Failed to load properties. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, [debouncedFilters, debouncedSearchQuery, currentPage, user, nearbyEnabled, location, searchRadius, viewMode]);

  const handleSearch = useCallback((e) => {
    e.preventDefault();
    loadProperties(true);
  }, [loadProperties]);

  const resetFilters = useCallback(() => {
    setFilters({
      minPrice: '',
      maxPrice: '',
      bedrooms: '',
      bathrooms: '',
      location: '',
      propertyType: '',
      listingType: '',
      sortBy: 'createdAt',
      sortOrder: 'desc'
    });
    setSearchQuery('');
  }, []);

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      setCurrentPage(prev => prev + 1);
      loadProperties(false);
    }
  }, [isLoading, hasMore, loadProperties]);

  // Auto-apply filters through useEffect, no manual apply needed

  // Helper function to check if a property is for rent (rental)
  const isPropertyForRent = (property) => {
    if (!property || !property.price) return true; // Default to rent
    
    const priceString = String(property.price).toLowerCase();
    
    // Keywords that indicate rentals
    const rentKeywords = [
      '/month', '/year', '/annum', 
      'per month', 'per year', 'per annum',
      'monthly', 'annually', 'yearly',
      'rent', 'rental', 'to let'
    ];
    
    // If any rent keywords are found, it's a rental
    return rentKeywords.some(keyword => priceString.includes(keyword));
  };

  // Helper function to extract price value from different formats
  const extractPriceValue = (property) => {
    const propertyPrice = 
      (typeof property.price === 'number' ? property.price : null) ||
      (property.priceNumeric) ||
      (property.rate && typeof property.rate === 'string' 
        ? parseFloat(property.rate.replace(/[^0-9.]/g, '')) 
        : null) ||
      (typeof property.price === 'string' 
        ? parseFloat(property.price.replace(/[^0-9.]/g, ''))
        : 0);
    
    return !isNaN(propertyPrice) ? propertyPrice : 0;
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header with Search and Filters */}
      <div className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4">
          {/* Search and Filter Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <h1 className="text-2xl font-bold text-blue-900">
              Property Listings
            </h1>
            <div className="flex flex-wrap items-center gap-2 md:gap-4">
              {/* View Toggle */}
              <ViewToggle view={viewMode} onViewChange={setViewMode} />
              {/* Tabs for Rent vs Sale - Matches MarketplaceListings approach */}
              <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                {listingTypes.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setFilters(prev => ({ ...prev, listingType: type.value }))}
                    className={`px-4 py-2 text-sm font-medium transition-colors
                      ${filters.listingType === type.value || (type.value === '' && !filters.listingType) 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>

              <button 
                type="button"
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className="flex-shrink-0 bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 touch-target min-h-[44px] min-w-[44px] justify-center"
                aria-label={isFilterOpen ? 'Hide filters' : 'Show filters'}
                aria-expanded={isFilterOpen}
              >
                <Filter size={20} />
                <span className="hidden sm:inline">Filters</span>
              </button>

              {/* Sort dropdown */}
              <select
                value={`${filters.sortBy}${filters.sortOrder}`}
                onChange={(e) => {
                  const value = e.target.value;
                  const sortBy = value.slice(0, -4); // Remove 'asc' or 'desc'
                  const sortOrder = value.slice(-4); // Get 'asc' or 'desc'
                  setFilters(prev => ({
                    ...prev,
                    sortBy,
                    sortOrder
                  }));
                  loadProperties(true);
                }}
                className="p-2 border rounded-lg bg-gray-50 text-gray-900 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              >
                <option value="createdAtdesc">Latest</option>
                <option value="priceasc">Price (Low to High)</option>
                <option value="pricedesc">Price (High to Low)</option>
                <option value="bedroomsdesc">Bedrooms</option>
              </select>
            </div>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
            <div className="flex-grow relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="text-gray-400" size={20} />
              </div>
              <input
                type="text"
                placeholder="Search properties..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base sm:text-sm"
                aria-label="Search properties by title, location, or description"
              />
            </div>
            <button 
              type="submit"
              disabled={isLoading}
              className="bg-blue-500 text-white px-4 py-3 sm:py-2 rounded-lg hover:bg-blue-600 transition-colors disabled:bg-blue-300 touch-target min-h-[44px] text-base sm:text-sm font-medium"
              aria-label="Search properties"
            >
              {isLoading ? 'Searching...' : 'Search'}
            </button>
          </form>

          {/* Property Filters */}
          <PropertyFilters
            filters={filters}
            setFilters={setFilters}
            onResetFilters={resetFilters}
            isFilterOpen={isFilterOpen}
            setIsFilterOpen={setIsFilterOpen}
          />
        </div>
      </div>

      {/* Properties Grid */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Loading State */}
        {isLoading && currentPage === 1 ? (
          <div className="grid place-items-center min-h-[50vh]">
            <div className="text-center">
              <Loader2 className="w-16 h-16 animate-spin text-blue-500 mx-auto mb-4" />
              <p className="text-gray-600">
                {nearbyEnabled ? 'Finding properties near you...' : 'Loading properties...'}
              </p>
              {nearbyEnabled && (
                <p className="text-sm text-gray-500 mt-2">
                  Searching within {searchRadius}km radius
                </p>
              )}
            </div>
          </div>
        ) : (
          <>
            {error ? (
              <ErrorBoundary>
                <div className="text-center py-12 bg-red-50 rounded-lg border border-red-200">
                  <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-red-800 mb-2">Something went wrong</h3>
                  <p className="text-red-600 mb-4">{error}</p>
                  <button
                    onClick={() => loadProperties(true)}
                    className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              </ErrorBoundary>
            ) : properties.length === 0 ? (
              <div className="text-center py-12 bg-gray-100 rounded-lg">
                <Home className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-800 mb-2">No properties found</h3>
                <p className="text-gray-600 mb-4">
                  {nearbyEnabled 
                    ? 'No properties found near your location. Try expanding your search radius.' 
                    : filters.listingType === 'sale'
                      ? 'No properties for sale found with your current criteria.'
                      : filters.listingType === 'rent'
                        ? 'No properties for rent found with your current criteria.'
                        : 'No properties found matching your search criteria.'}
                </p>
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={resetFilters}
                    className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    Reset Filters
                  </button>
                  {nearbyEnabled && (
                    <button
                      onClick={() => window.location.reload()}
                      className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                    >
                      Refresh Search
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* Results count and Post button */}
                <div className="mb-6 flex justify-between items-center">
                  <p className="text-gray-600">
                    Showing {properties.length} of {(totalCount + getOfflineCount(filters.listingType)).toLocaleString()} properties
                    {nearbyEnabled && location && (
                      <span className="ml-2 text-blue-600">
                        within {searchRadius}km of your location
                      </span>
                    )}
                  </p>
                  <Link
                    href="/dashboard?tab=post-ad&type=property"
                    className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5v14M5 12h14"/>
                    </svg>
                    Post Property Listing
                  </Link>
                </div>
                
                {/* Conditional rendering for List vs Map view */}
                {viewMode === 'map' ? (
                  <div className="bg-white rounded-lg shadow-lg overflow-hidden" style={{ height: '700px' }}>
                    <PropertyMap 
                      properties={properties}
                      isLoading={isLoading}
                      hasMore={hasMore}
                      onLoadMore={loadMore}
                    />
                  </div>
                ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {properties.map((property) => (
                    <Link 
                      href={`/property/${property.slug}`}
                      key={property.id} 
                      className="group focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-xl"
                      aria-label={`View details for ${property.title}`}
                    >
                      <div className="bg-white rounded-xl shadow-lg overflow-hidden transform transition-all hover:-translate-y-1 md:hover:-translate-y-2 hover:shadow-xl touch-target">
                        <div className="relative">
                          <img
                            src={property.imageUrls[0]}
                            alt={`Photo of ${property.title}`}
                            className="w-full h-48 sm:h-56 object-cover"
                            loading="lazy"
                          />
                          
                          {/* Display listing type tag */}
                          <div className="absolute top-4 right-4 flex flex-col gap-2">
                            <span className={`px-3 py-1 rounded-full text-sm font-medium 
                              ${property.listingType === 'sale' || (!property.listingType && !property.isForRent)
                                ? 'bg-green-500 text-white' 
                                : 'bg-blue-500 text-white'}`}
                            >
                              {property.listingType === 'sale' || (!property.listingType && !property.isForRent)
                                ? 'For Sale' 
                                : 'For Rent'}
                            </span>
                            
                            <span className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-sm">
                              {property.propertyType || property.type || 'Property'}
                            </span>
                          </div>
                          
                          {/* Distance Badge - only show when proximity filter is active */}
                          {nearbyEnabled && location && (
                            <DistanceBadge 
                              item={property} 
                              className="absolute bottom-2 right-2"
                            />
                          )}
                        </div>
                        
                        <div className="p-4 sm:p-6">
                          <h3 className="text-lg sm:text-xl font-bold text-blue-900 mb-2 group-hover:text-blue-700 transition-colors line-clamp-2 leading-tight">
                            {property.title}
                          </h3>
                          
                          <div className="flex items-center text-gray-600 mb-3 sm:mb-4">
                            <MapPin size={16} className="mr-2 text-blue-500 flex-shrink-0" />
                            <span className="line-clamp-1 text-sm sm:text-base">{property.location}</span>
                          </div>
                          
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                            <div className="text-xl sm:text-2xl font-bold text-blue-900 truncate">
                              {property.displayPrice}
                            </div>
                            <div className="flex space-x-3 justify-end sm:justify-start">
                              {property.bedrooms && (
                                <div className="flex items-center text-gray-600" title={`${property.bedrooms} bedroom(s)`}>
                                  <Bed size={16} className="mr-1 text-blue-500" />
                                  <span className="text-sm">{property.bedrooms}</span>
                                </div>
                              )}
                              {property.bathrooms && (
                                <div className="flex items-center text-gray-600" title={`${property.bathrooms} bathroom(s)`}>
                                  <Bath size={16} className="mr-1 text-blue-500" />
                                  <span className="text-sm">{property.bathrooms}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
                )}

                {/* Load More Button - Show only for list view */}
                {viewMode === 'list' && hasMore && (
                  <div className="text-center mt-8">
                    <button 
                      onClick={loadMore}
                      disabled={isLoading}
                      className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center mx-auto disabled:bg-gray-400 disabled:cursor-not-allowed"
                      aria-label="Load more properties"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 animate-spin" size={20} />
                          Loading more...
                        </>
                      ) : (
                        'Load More Properties'
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
});

// Export wrapped in ErrorBoundary for production safety
export default function WrappedPropertyListings() {
  return (
    <ErrorBoundary>
      <PropertyListings />
    </ErrorBoundary>
  );
}
