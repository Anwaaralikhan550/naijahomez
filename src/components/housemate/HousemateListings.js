'use client';
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  Filter, Search, X, Loader2, 
  MapPin, ChevronDown, DollarSign, Users, Home
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import apiService from '@/services/api';
import { useDebounce } from '@/hooks/useDebounce';
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import HousemateListingCard from './HousemateListingCard';
import DistanceBadge from '@/components/shared/DistanceBadge';
import { useSearchRecommendations } from '@/hooks/useSearchRecommendations';
import SearchDropdown from '@/components/shared/SearchDropdown';

function HousemateListings(props = {}) {
  // Authentication context
  const { user } = useAuth();
  
  // Search recommendations hook
  const {
    isOpen: isDropdownOpen,
    recommendations,
    isLoading: isRecommendationsLoading,
    handleFocus: handleSearchFocus,
    handleClose: handleDropdownClose,
    dropdownRef
  } = useSearchRecommendations('housemate');
  
  // Component state
  const [listings, setListings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState({ page: 1, hasMore: true, total: 0 });
  const [filters, setFilters] = useState({
    minPrice: '',
    maxPrice: '',
    advertType: '',
    propertyType: '',
    amenities: [],
    location: '',
    preferredGender: '',
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });
  const [savedListings, setSavedListings] = useState([]);
  
  // Debounced search query
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  
  // Search input ref for dropdown positioning
  const searchInputRef = useRef(null);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        handleDropdownClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [handleDropdownClose]);
  
  // Define advert types
  const advertTypes = [
    { value: '', label: 'All Advert Types' },
    { value: 'room_for_rent', label: 'Room for Rent' },
    { value: 'room_wanted', label: 'Room Wanted' },
    { value: 'buddy_up', label: 'Buddy Up to Find Room' }
  ];
  
  // Define property types
  const propertyTypes = [
    { value: '', label: 'All Property Types' },
    { value: 'house_share', label: 'Room in House Share' },
    { value: 'self_contained_room', label: 'Self-Contained Room' },
    { value: 'self_contained_flat', label: 'Self-Contained Flat' },
    { value: 'whole_property', label: 'Whole Property to Share' },
    // Legacy types
    { value: 'private', label: 'Private Room' },
    { value: 'shared', label: 'Shared Room' },
    { value: 'studio', label: 'Studio Apartment' },
    { value: 'ensuite', label: 'En-suite Room' }
  ];
  
  // Define gender preferences
  const genderOptions = [
    { value: '', label: 'Any Gender' },
    { value: 'any', label: 'No Preference' },
    { value: 'female', label: 'Females Only' },
    { value: 'male', label: 'Males Only' },
    { value: 'male_or_female', label: 'Males or Females' },
    { value: 'couples', label: 'Couples' }
  ];
  
  // Define amenities
  const amenitiesOptions = [
    { value: 'ensuite', label: 'Ensuite' },
    { value: 'private_kitchen', label: 'Private Kitchen' },
    { value: 'furnished', label: 'Furnished' },
    { value: 'car_park', label: 'Car Park' },
    { value: '24hr_light', label: '24hrs Light' },
    { value: 'gated_security', label: 'Gated with Security' },
    { value: 'garden', label: 'Garden' },
    { value: 'broadband', label: 'Broadband' },
    { value: 'wifi', label: 'WiFi' },
    { value: 'laundry', label: 'Laundry' },
    { value: 'bathroom', label: 'Private Bathroom' },
    { value: 'ac', label: 'Air Conditioning' }
  ];
  
  // Initial load and search effect
  useEffect(() => {
    loadListings(true);
    
    // Load saved listings from localStorage
    const loadSaved = () => {
      try {
        const saved = localStorage.getItem('savedHousemates');
        if (saved) {
          setSavedListings(JSON.parse(saved));
        }
      } catch (error) {
        console.error('Error loading saved listings:', error);
      }
    };
    
    loadSaved();
  }, [debouncedSearchQuery, filters]);
  
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
  
  const loadListings = async (reset = false) => {
    try {
      setIsLoading(true);
      
      if (reset) {
        setPagination({ page: 1, hasMore: true });
        setListings([]);
      }
      
      // Build API parameters
      const params = {
        page: reset ? 1 : pagination.page,
        limit: 12,
        search: debouncedSearchQuery.trim(),
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        ...(filters.minPrice && { minBudget: filters.minPrice }),
        ...(filters.maxPrice && { maxBudget: filters.maxPrice }),
        ...(filters.advertType && { advertType: filters.advertType }),
        ...(filters.propertyType && { roomType: filters.propertyType }),
        ...(filters.preferredGender && { gender: filters.preferredGender }),
        ...(filters.location && { location: filters.location })
      };
      
      // Make API call (authentication handled via HTTP-only cookies)
      const response = await apiService.getHousemates(params);
      
      if (response.success) {
        const newListings = response.data || [];
        
        if (reset) {
          setListings(newListings);
        } else {
          setListings(prev => [...prev, ...newListings]);
        }
        
        setPagination({
          page: response.pagination?.page || 1,
          hasMore: response.pagination?.hasMore || false,
          total: response.pagination?.total || 0
        });
        
        setError(null);
      } else {
        throw new Error(response.error || 'Failed to fetch listings');
      }
    } catch (error) {
      console.error('Error loading housemate listings:', error);
      setError('Failed to load listings. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    
    // Handle price formatting
    if (name === 'minPrice' || name === 'maxPrice') {
      const parsedValue = parsePrice(value);
      if (parsedValue === '' || /^\d*$/.test(parsedValue)) {
        setFilters(prev => ({
          ...prev,
          [name]: parsedValue
        }));
      }
      return;
    }
    
    // Handle amenities (checkbox)
    if (name === 'amenities') {
      const amenity = value;
      setFilters(prev => {
        const updatedAmenities = prev.amenities.includes(amenity)
          ? prev.amenities.filter(a => a !== amenity)
          : [...prev.amenities, amenity];
        
        return {
          ...prev,
          amenities: updatedAmenities
        };
      });
      return;
    }

    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const resetFilters = () => {
    setFilters({
      minPrice: '',
      maxPrice: '',
      advertType: '',
      propertyType: '',
      amenities: [],
      location: '',
      preferredGender: '',
      sortBy: 'createdAt',
      sortOrder: 'desc'
    });
    setSearchQuery('');
    loadListings(true);
  };

  // Load more listings
  const loadMore = () => {
    if (!isLoading && pagination.hasMore) {
      setPagination(prev => ({ ...prev, page: prev.page + 1 }));
      loadListings(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadListings(true);
  };

  const removeFilter = (filterName) => {
    if (filterName === 'amenities') {
      setFilters(prev => ({ ...prev, amenities: [] }));
    } else {
      setFilters(prev => ({ ...prev, [filterName]: '' }));
    }
    loadListings(true);
  };

  const applyFilters = () => {
    loadListings(true);
  };

  // Toggle save status for a listing
  const toggleSave = (listingId) => {
    const newSavedListings = savedListings.includes(listingId)
      ? savedListings.filter(id => id !== listingId)
      : [...savedListings, listingId];
    
    setSavedListings(newSavedListings);
    
    // Save to localStorage
    try {
      localStorage.setItem('savedHousemates', JSON.stringify(newSavedListings));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  };

  // Helper function to extract price value from different formats
  const extractPriceValue = (listing) => {
    // Try to extract numeric value from rate string if present
    if (listing.rate) {
      const matches = listing.rate.match(/[\d,]+/);
      if (matches && matches[0]) {
        return parseFloat(matches[0].replace(/,/g, ''));
      }
    }
    
    const listingPrice = 
      (typeof listing.price === 'number' ? listing.price : null) ||
      (listing.priceNumeric) ||
      (typeof listing.price === 'string' 
        ? parseFloat(listing.price.replace(/[^0-9.]/g, ''))
        : 0);
    
    return !isNaN(listingPrice) ? listingPrice : 0;
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-8">
          {/* Title */}
          <h1 className="text-3xl font-bold text-blue-900 mb-6">
            Find a Housemate or Room
          </h1>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="mb-6 flex gap-2">
            <div className="relative flex-grow" ref={searchInputRef}>
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="text-gray-400" size={20} />
              </div>
              <input
                type="text"
                placeholder="Search by location, title, or amenities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={handleSearchFocus}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <SearchDropdown
                isOpen={isDropdownOpen}
                recommendations={recommendations}
                isLoading={isRecommendationsLoading}
                onClose={handleDropdownClose}
                searchQuery={searchQuery}
                dropdownRef={dropdownRef}
              />
            </div>
            <button 
              type="submit"
              disabled={isLoading}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors disabled:bg-blue-300"
            >
              {isLoading ? 'Searching...' : 'Search'}
            </button>
            <button 
              type="button"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className="bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
            >
              <Filter size={20} />
              <span className="hidden md:inline">Filters</span>
            </button>
          </form>

          {/* Advanced Filters */}
          {isFilterOpen && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="grid md:grid-cols-3 gap-4">
                {/* Price Range */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Monthly Rent Range</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      name="minPrice"
                      value={formatPrice(filters.minPrice)}
                      placeholder="Min Rent"
                      onChange={handleFilterChange}
                      className="p-2 border rounded-lg bg-white text-gray-900 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      name="maxPrice"
                      value={formatPrice(filters.maxPrice)}
                      placeholder="Max Rent"
                      onChange={handleFilterChange}
                      className="p-2 border rounded-lg bg-white text-gray-900 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Advert Type */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Advert Type</label>
                  <select 
                    name="advertType"
                    value={filters.advertType}
                    onChange={handleFilterChange}
                    className="w-full p-2 border rounded-lg bg-white text-gray-900 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  >
                    {advertTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Property Type */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Property Type</label>
                  <select 
                    name="propertyType"
                    value={filters.propertyType}
                    onChange={handleFilterChange}
                    className="w-full p-2 border rounded-lg bg-white text-gray-900 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  >
                    {propertyTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Gender Preference */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Gender Preference</label>
                  <select 
                    name="preferredGender"
                    value={filters.preferredGender}
                    onChange={handleFilterChange}
                    className="w-full p-2 border rounded-lg bg-white text-gray-900 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  >
                    {genderOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Location */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Location</label>
                  <input
                    type="text"
                    name="location"
                    value={filters.location}
                    placeholder="Enter location"
                    onChange={handleFilterChange}
                    className="w-full p-2 border rounded-lg bg-white text-gray-900 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Sort Order */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Sort By</label>
                  <select
                    name="sortBy"
                    value={filters.sortBy}
                    onChange={(e) => {
                      const sortOptions = {
                        'newest': { sortBy: 'createdAt', sortOrder: 'desc' },
                        'oldest': { sortBy: 'createdAt', sortOrder: 'asc' },
                        'price_low': { sortBy: 'price', sortOrder: 'asc' },
                        'price_high': { sortBy: 'price', sortOrder: 'desc' }
                      };
                      
                      const option = e.target.value;
                      const sortValue = sortOptions[option] || sortOptions['newest'];
                      
                      setFilters(prev => ({
                        ...prev,
                        sortBy: sortValue.sortBy,
                        sortOrder: sortValue.sortOrder
                      }));
                    }}
                    className="w-full p-2 border rounded-lg bg-white text-gray-900 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="price_low">Price (Low to High)</option>
                    <option value="price_high">Price (High to Low)</option>
                  </select>
                </div>

                {/* Amenities */}
                <div className="space-y-2 md:col-span-3">
                  <label className="block text-sm font-medium text-gray-700">Amenities</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {amenitiesOptions.map((amenity) => (
                      <label key={amenity.value} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          name="amenities"
                          value={amenity.value}
                          checked={filters.amenities.includes(amenity.value)}
                          onChange={handleFilterChange}
                          className="rounded text-blue-500 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{amenity.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Filter Actions */}
                <div className="md:col-span-3 flex justify-end gap-4 mt-4">
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    Reset Filters
                  </button>
                  <button
                    type="button"
                    onClick={applyFilters}
                    className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Active Filters */}
          {(Object.values(filters).some(value => 
            value !== '' && value !== 'createdAt' && value !== 'desc' && 
            !(Array.isArray(value) && value.length === 0)) || 
            searchQuery) && (
            <div className="flex flex-wrap gap-2 items-center my-4">
              <span className="text-gray-600">Active Filters:</span>
              {searchQuery && (
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
                  Search: {searchQuery}
                  <button onClick={() => { setSearchQuery(''); loadListings(true); }} className="hover:text-blue-600">
                    <X size={14} />
                  </button>
                </span>
              )}
              {filters.advertType && (
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
                  Type: {advertTypes.find(t => t.value === filters.advertType)?.label}
                  <button onClick={() => { removeFilter('advertType'); }} className="hover:text-blue-600">
                    <X size={14} />
                  </button>
                </span>
              )}
              {filters.propertyType && (
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
                  Property: {propertyTypes.find(t => t.value === filters.propertyType)?.label}
                  <button onClick={() => { removeFilter('propertyType'); }} className="hover:text-blue-600">
                    <X size={14} />
                  </button>
                </span>
              )}
              {filters.preferredGender && (
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
                  Gender: {genderOptions.find(g => g.value === filters.preferredGender)?.label}
                  <button onClick={() => { removeFilter('preferredGender'); }} className="hover:text-blue-600">
                    <X size={14} />
                  </button>
                </span>
              )}
              {filters.location && (
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
                  Location: {filters.location}
                  <button onClick={() => { removeFilter('location'); }} className="hover:text-blue-600">
                    <X size={14} />
                  </button>
                </span>
              )}
              {filters.amenities.length > 0 && (
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
                  Amenities: {filters.amenities.length} selected
                  <button onClick={() => { removeFilter('amenities'); }} className="hover:text-blue-600">
                    <X size={14} />
                  </button>
                </span>
              )}
              {(filters.minPrice || filters.maxPrice) && (
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
                  Rent: {filters.minPrice ? `₦${formatPrice(filters.minPrice)}` : '0'} 
                  - 
                  {filters.maxPrice ? `₦${formatPrice(filters.maxPrice)}` : 'Any'}
                  <button 
                    onClick={() => { 
                      removeFilter('minPrice');
                      removeFilter('maxPrice');
                    }}
                    className="hover:text-blue-600"
                  >
                    <X size={14} />
                  </button>
                </span>
              )}
              <button
                onClick={resetFilters}
                className="text-blue-500 hover:text-blue-600 text-sm ml-2"
              >
                Clear All
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Housemate Listings Grid */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Loading State */}
        {isLoading ? (
          <div className="grid place-items-center min-h-[50vh]">
            <div className="text-center">
              <Loader2 className="w-16 h-16 animate-spin text-blue-500 mx-auto mb-4" />
              <p className="text-gray-600">
                Loading housemate listings...
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Error State */}
            {error && (
              <div className="text-center py-12 bg-red-50 rounded-lg">
                <h2 className="text-2xl text-red-600 mb-4">Oops! Something went wrong</h2>
                <p className="text-red-500 mb-4">{error}</p>
                <button 
                  onClick={() => loadListings(true)}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* No Results State */}
            {!error && listings.length === 0 && (
              <div className="text-center py-12 bg-gray-100 rounded-lg">
                <h2 className="text-2xl text-gray-600 mb-4">No Housemates Found</h2>
                <p className="text-gray-500 mb-4">
                  {searchQuery.trim() 
                    ? `No listings match your search for "${searchQuery}"`
                    : 'No listings match your current filters'}
                </p>
                <button 
                  onClick={resetFilters}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Reset Filters
                </button>
              </div>
            )}

            {/* Listings Grid */}
            {!error && listings.length > 0 && (
              <>
                {/* Listing count and Post button */}
                <div className="mb-6 flex justify-between items-center">
                  <p className="text-sm text-gray-600">
                    Showing {listings.length} of {pagination.total} results
                  </p>
                  <Link
                    href="/dashboard?tab=post-ad&type=housemate"
                    className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5v14M5 12h14"/>
                    </svg>
                    Post Housemate Listing
                  </Link>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  {listings.map((listing) => (
                    <HousemateListingCard
                      key={listing.id}
                      listing={listing}
                      onSaveToggle={toggleSave}
                      isSaved={savedListings.includes(listing.id)}
                    />
                  ))}
                </div>

                {/* Load More Button */}
                {pagination.hasMore && (
                  <div className="text-center mt-8">
                    <button
                      onClick={loadMore}
                      disabled={isLoading}
                      className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center mx-auto disabled:bg-gray-400"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 animate-spin" size={20} />
                          Loading...
                        </>
                      ) : (
                        'Load More Listings'
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
}

// Export wrapped in ErrorBoundary for production safety
export default function WrappedHousemateListings(props) {
  return (
    <ErrorBoundary>
      <HousemateListings {...props} />
    </ErrorBoundary>
  );
}