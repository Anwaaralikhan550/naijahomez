'use client';
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { MapPin, Star, Filter, Clock, Loader2, X, Briefcase, Award, GraduationCap, ShieldCheck } from 'lucide-react';
import apiService from '@/services/api';
import { slugify } from '@/utils/slugify';
import { withProximityFilter } from '@/utils/withProximityFilter';
import { useGeolocationContext } from '@/context/GeolocationContext';
import DistanceBadge from '@/components/shared/DistanceBadge';
import { useSearchRecommendations } from '@/hooks/useSearchRecommendations';
import SearchDropdown from '@/components/shared/SearchDropdown';

function TradespeopleListings({ data: proximityFilteredServices = [], isLoading: isProximityLoading, isProximityFiltered }) {
  // Get geolocation context to check if 'Near Me' is enabled
  const { nearbyEnabled, searchRadius } = useGeolocationContext();
  
  // Search recommendations hook
  const {
    isOpen: isDropdownOpen,
    recommendations,
    isLoading: isRecommendationsLoading,
    handleFocus: handleSearchFocus,
    handleClose: handleDropdownClose,
    dropdownRef
  } = useSearchRecommendations('service');
  
  // Regular component state
  const [error, setError] = useState(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredServices, setFilteredServices] = useState([]);
  const [displayCount, setDisplayCount] = useState(12);
  const [filters, setFilters] = useState({
    minPrice: '',
    maxPrice: '',
    serviceType: '',
    businessType: '',
    experience: '',
    location: '',
    sortBy: 'rating',
    sortOrder: 'desc'
  });
  const [isLocalLoading, setIsLocalLoading] = useState(true);
  const [originalData, setOriginalData] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  
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
  
  // Additional state variables to handle local pagination
  const [hasMoreLocal, setHasMoreLocal] = useState(true);

  // Initial load
  useEffect(() => {
    loadServices(true);
  }, []);

  const loadServices = async (reset = false) => {
    if (reset) {
      setFilteredServices([]);
      setDisplayCount(12);
    }

    setIsLocalLoading(true);
    setError(null);

    try {
      // Use API service to get tradespeople/services
      const response = await apiService.getTradespeople({
        limit: 50,
        sortBy: filters.sortBy,
        sortOrder: filters.sortBy === 'rating' ? 'desc' : 'desc',
        ...(filters.serviceType && { serviceType: filters.serviceType }),
        ...(searchQuery.trim() && { search: searchQuery.trim() })
      });
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to load tradespeople');
      }

      // Store total count from API
      setTotalCount(response.pagination?.total || 0);

      let allServices = (response.data || []).map(service => ({
        ...service,
        slug: service.slug || slugify(`${service.title}-${service.id}`)
      }));
      
      // Apply client-side filters
      
      // Apply price filters
      if (filters.minPrice) {
        const minPriceValue = parseFloat(filters.minPrice);
        allServices = allServices.filter(service => {
          const price = extractPriceValue(service);
          return price >= minPriceValue;
        });
      }
      
      if (filters.maxPrice) {
        const maxPriceValue = parseFloat(filters.maxPrice);
        allServices = allServices.filter(service => {
          const price = extractPriceValue(service);
          return price <= maxPriceValue;
        });
      }
      
      // Apply business type filter
      if (filters.businessType) {
        allServices = allServices.filter(service => 
          service.businessType === filters.businessType
        );
      }
      
      // Apply experience filter
      if (filters.experience) {
        const expValue = parseInt(filters.experience);
        allServices = allServices.filter(service => {
          const serviceExp = parseInt(service.experience || '0');
          return serviceExp >= expValue;
        });
      }
      
      // Apply location filter
      if (filters.location) {
        const locationLower = filters.location.toLowerCase();
        allServices = allServices.filter(service => 
          service.location && 
          service.location.toLowerCase().includes(locationLower)
        );
      }
      
      // Filter out services without images
      const validServices = allServices.filter(
        service => service.imageUrls && service.imageUrls.length > 0
      );
      
      // Store the original filtered results (before pagination)
      setOriginalData(validServices);
      
      // Apply pagination for local data view
      setFilteredServices(validServices.slice(0, displayCount));
      
      // Check if there are more services to load locally
      setHasMoreLocal(validServices.length > displayCount);
    } catch (error) {
      console.error('Error loading services:', error);
      setError('Failed to load services. Please try again later.');
    } finally {
      setIsLocalLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadServices(true);
  };

  const handleSortChange = (e) => {
    const value = e.target.value;
    const sortOption = sortOptions.find(option => option.value + option.order === value);
    
    if (sortOption) {
      setFilters(prev => ({
        ...prev,
        sortBy: sortOption.value,
        sortOrder: sortOption.order
      }));
      
      loadServices(true);
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

    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const resetFilters = () => {
    setFilters({
      minPrice: '',
      maxPrice: '',
      serviceType: '',
      businessType: '',
      experience: '',
      location: '',
      sortBy: 'rating',
      sortOrder: 'desc'
    });
    setSearchQuery('');
    loadServices(true);
  };

  // Load more services for local data
  const loadMoreLocal = () => {
    // Increase the display count by 12
    const newDisplayCount = displayCount + 12;
    setDisplayCount(newDisplayCount);
    
    // Update the displayed services based on the new count
    setFilteredServices(originalData.slice(0, newDisplayCount));
    
    // Check if there are more services to load
    setHasMoreLocal(originalData.length > newDisplayCount);
  };

  const removeFilter = (filterName) => {
    setFilters(prev => ({ ...prev, [filterName]: '' }));
    loadServices(true);
  };

  const applyFilters = () => {
    loadServices(true);
  };
  
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
  
  // Helper function to extract price value from different formats
  const extractPriceValue = (service) => {
    const servicePrice = 
      // First try price as a number
      (typeof service.price === 'number' ? service.price : null) ||
      // Then try fixedRate field
      (service.fixedRate ? parseFloat(service.fixedRate) : null) ||
      // Then try hourlyRate field
      (service.hourlyRate ? parseFloat(service.hourlyRate) : null) ||
      // Then try priceNumeric field if it exists
      (service.priceNumeric) ||
      // Then try to extract numbers from rate string if it exists
      (service.rate && typeof service.rate === 'string' 
        ? parseFloat(service.rate.replace(/[^0-9.]/g, '')) 
        : null) ||
      // Then try to extract from priceString if it exists
      (service.priceString && typeof service.priceString === 'string'
        ? parseFloat(service.priceString.replace(/[^0-9.]/g, ''))
        : null) ||
      // Finally try to parse price as string
      (typeof service.price === 'string' 
        ? parseFloat(service.price.replace(/[^0-9.]/g, ''))
        : 0);
    
    return !isNaN(servicePrice) ? servicePrice : 0;
  };

  // Helper function to get business type display label
  const getBusinessTypeLabel = (type) => {
    const businessTypes = {
      'sole_trader': 'Sole Trader',
      'small_company': 'Small Company',
      'medium_company': 'Medium Company',
      'large_company': 'Large Company'
    };
    return businessTypes[type] || type;
  };
  
  // Define service categories
  const serviceCategories = [
    { value: '', label: 'All Categories' },
    { value: 'plumber', label: 'Plumbers' },
    { value: 'electrician', label: 'Electricians' },
    { value: 'carpenter', label: 'Carpenters' },
    { value: 'painter', label: 'Painters' },
    { value: 'generator-repair', label: 'Generator Repair' },
    { value: 'ac-repair', label: 'AC Repair' },
    { value: 'gardener', label: 'Gardeners' },
    { value: 'cleaner', label: 'Cleaners' },
    { value: 'developer', label: 'Developers' },
    { value: 'designer', label: 'Designers' },
    { value: 'tutor', label: 'Tutors' },
    { value: 'other', label: 'Other Services' }
  ];

  const businessTypeOptions = [
    { value: '', label: 'All Business Types' },
    { value: 'sole_trader', label: 'Sole Trader / Freelancer' },
    { value: 'small_company', label: 'Small Company' },
    { value: 'medium_company', label: 'Medium Company' },
    { value: 'large_company', label: 'Large Company' }
  ];

  const experienceOptions = [
    { value: '', label: 'Any Experience' },
    { value: '1', label: '1+ Years' },
    { value: '3', label: '3+ Years' },
    { value: '5', label: '5+ Years' },
    { value: '10', label: '10+ Years' }
  ];

  const sortOptions = [
    { value: 'rating', label: 'Highest Rated', order: 'desc' },
    { value: 'price', label: 'Price (Low to High)', order: 'asc' },
    { value: 'price', label: 'Price (High to Low)', order: 'desc' },
    { value: 'experience', label: 'Most Experienced', order: 'desc' },
    { value: 'createdAt', label: 'Newest First', order: 'desc' }
  ];

  // Determine which services to display based on whether geolocation is enabled
  const servicesData = nearbyEnabled ? proximityFilteredServices : filteredServices;
  
  // Determine whether we're loading based on which data source we're using
  const isCurrentlyLoading = nearbyEnabled ? isProximityLoading : isLocalLoading;
  
  // Determine if there are more items to load
  const hasMore = nearbyEnabled ? proximityFilteredServices.length >= displayCount : hasMoreLocal;
  
  // Function to load more items
  const loadMore = nearbyEnabled ? () => {} : loadMoreLocal;

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header with Search and Filters */}
      <div className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4">
          {/* Search and Filter Header */}
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-blue-900">
              Tradespeople
            </h1>
            <div className="flex items-center gap-4">
              <select
                value={`${filters.sortBy}${filters.sortOrder}`}
                onChange={handleSortChange}
                className="p-2 border rounded-lg bg-gray-50 text-gray-900 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              >
                {sortOptions.map((option) => (
                  <option key={option.value + option.order} value={option.value + option.order}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button 
                type="button"
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className="bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
              >
                <Filter size={20} />
                <span>Filters</span>
              </button>
            </div>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="flex items-center space-x-4">
            <div className="flex-grow relative" ref={searchInputRef}>
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search for service providers..."
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
              disabled={isLocalLoading}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors disabled:bg-blue-300"
            >
              {isLocalLoading ? 'Searching...' : 'Search'}
            </button>
          </form>

          {/* Advanced Filters */}
          {isFilterOpen && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="grid md:grid-cols-3 gap-4">
                {/* Price Range */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Price Range</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      name="minPrice"
                      value={formatPrice(filters.minPrice)}
                      placeholder="Min Price"
                      onChange={handleFilterChange}
                      className="p-2 border rounded-lg bg-white text-gray-900 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      name="maxPrice"
                      value={formatPrice(filters.maxPrice)}
                      placeholder="Max Price"
                      onChange={handleFilterChange}
                      className="p-2 border rounded-lg bg-white text-gray-900 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Service Category */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Service Category</label>
                  <select 
                    name="serviceType"
                    value={filters.serviceType}
                    onChange={handleFilterChange}
                    className="w-full p-2 border rounded-lg bg-white text-gray-900 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  >
                    {serviceCategories.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Business Type */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Business Type</label>
                  <select 
                    name="businessType"
                    value={filters.businessType}
                    onChange={handleFilterChange}
                    className="w-full p-2 border rounded-lg bg-white text-gray-900 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  >
                    {businessTypeOptions.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Experience */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Experience</label>
                  <select 
                    name="experience"
                    value={filters.experience}
                    onChange={handleFilterChange}
                    className="w-full p-2 border rounded-lg bg-white text-gray-900 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  >
                    {experienceOptions.map((option) => (
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
        </div>
      </div>

      {/* Active Filters */}
      {(Object.values(filters).some(value => value !== '' && value !== 'rating' && value !== 'desc') || searchQuery) && (
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-gray-600">Active Filters:</span>
            {searchQuery && (
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
                Search: {searchQuery}
                <button onClick={() => { setSearchQuery(''); loadServices(true); }} className="hover:text-blue-600">
                  <X size={14} />
                </button>
              </span>
            )}
            {filters.serviceType && (
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
                Category: {serviceCategories.find(c => c.value === filters.serviceType)?.label}
                <button onClick={() => { removeFilter('serviceType'); }} className="hover:text-blue-600">
                  <X size={14} />
                </button>
              </span>
            )}
            {filters.businessType && (
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
                Business: {getBusinessTypeLabel(filters.businessType)}
                <button onClick={() => { removeFilter('businessType'); }} className="hover:text-blue-600">
                  <X size={14} />
                </button>
              </span>
            )}
            {filters.experience && (
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
                Experience: {filters.experience}+ years
                <button onClick={() => { removeFilter('experience'); }} className="hover:text-blue-600">
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
            {(filters.minPrice || filters.maxPrice) && (
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
                Price: {filters.minPrice ? `₦${formatPrice(filters.minPrice)}` : '0'} 
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
        </div>
      )}

      {/* Services Grid */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Loading State */}
        {isCurrentlyLoading ? (
          <div className="grid place-items-center min-h-[50vh]">
            <div className="text-center">
              <Loader2 className="w-16 h-16 animate-spin text-blue-500 mx-auto mb-4" />
              <p className="text-gray-600">
                {nearbyEnabled ? `Finding services within ${searchRadius}km...` : 'Loading services...'}
              </p>
            </div>
          </div>
        ) : (
          // Regular content
          <>
            {/* Error State */}
            {error && (
              <div className="text-center py-12 bg-red-50 rounded-lg">
                <h2 className="text-2xl text-red-600 mb-4">Oops! Something went wrong</h2>
                <p className="text-red-500 mb-4">{error}</p>
                <button 
                  onClick={() => loadServices(true)}
                  className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* No Results State */}
            {!isCurrentlyLoading && !error && servicesData.length === 0 && (
              <div className="text-center py-12 bg-gray-100 rounded-lg">
                <h2 className="text-2xl text-gray-600 mb-4">No Service Providers Found</h2>
                <p className="text-gray-500 mb-4">
                  {nearbyEnabled 
                    ? 'No service providers found near your location' 
                    : searchQuery.trim() 
                      ? `No service providers match your search for "${searchQuery}"`
                      : 'No service providers match your current filters'}
                </p>
                <button 
                  onClick={resetFilters}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Reset Filters
                </button>
              </div>
            )}

            {/* Services Grid */}
            {servicesData.length > 0 && (
              <>
                {/* Listing count and Post button */}
                <div className="mb-6 flex justify-between items-center">
                  <p className="text-sm text-gray-600">
                    Showing {servicesData.length} of {totalCount} results
                  </p>
                  <Link
                    href="/dashboard?tab=post-ad&type=service"
                    className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5v14M5 12h14"/>
                    </svg>
                    Post Tradesperson Listing
                  </Link>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  {servicesData.map((service) => (
                    <Link 
                      href={`/tradespeople/${service.slug}`}
                      key={service.id} 
                      className="group"
                    >
                      <div className="bg-white rounded-xl shadow-lg overflow-hidden transform transition-all hover:-translate-y-2 hover:shadow-xl">
                        <div className="relative">
                          <img
                            src={service.imageUrls[0]}
                            alt={service.title}
                            className="w-full h-56 object-cover"
                            loading="lazy"
                          />
                          <div className="absolute top-4 right-4 bg-blue-500 text-white px-3 py-1 rounded-full text-sm">
                            {service.serviceType}
                          </div>
                          
                          {/* Business Type Badge */}
                          {service.businessType && (
                            <div className="absolute top-4 left-4 bg-purple-500 text-white px-3 py-1 rounded-full text-sm">
                              {getBusinessTypeLabel(service.businessType)}
                            </div>
                          )}
                          
                          {/* Distance Badge - only show when nearbyEnabled is true */}
                          {nearbyEnabled && (
                            <DistanceBadge 
                              item={service} 
                              className="absolute bottom-2 right-2"
                            />
                          )}
                        </div>
                        
                        <div className="p-6">
                          <h3 className="text-xl font-bold text-blue-900 mb-2 group-hover:text-blue-700 transition-colors line-clamp-2">
                            {service.title}
                          </h3>
                          
                          {service.provider && (
                            <p className="text-gray-600 mb-2">{service.provider}</p>
                          )}
                          
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            {/* Rating badge */}
                            {service.rating && (
                              <div className="flex items-center text-sm bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                                <Star className="text-amber-500 w-3 h-3 mr-1" />
                                <span>{service.rating}</span>
                                {service.reviewCount && (
                                  <span className="text-amber-600 text-xs ml-1">({service.reviewCount})</span>
                                )}
                              </div>
                            )}
                            
                            {/* Experience badge */}
                            {service.experience && (
                              <div className="flex items-center text-sm bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                                <Briefcase className="w-3 h-3 mr-1" />
                                <span>{service.experience} yr{parseInt(service.experience) !== 1 ? 's' : ''}</span>
                              </div>
                            )}
                            
                            {/* Qualifications indicator */}
                            {service.qualifications && (
                              <div className="flex items-center text-sm bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                                <GraduationCap className="w-3 h-3 mr-1" />
                                <span>Qualified</span>
                              </div>
                            )}
                            
                            {/* Insurance indicator */}
                            {service.insuranceDetails && (
                              <div className="flex items-center text-sm bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">
                                <ShieldCheck className="w-3 h-3 mr-1" />
                                <span>Insured</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center text-gray-600 mb-4">
                            <MapPin size={18} className="mr-2 text-blue-500" />
                            <span className="line-clamp-1">{service.location}</span>
                          </div>
                          
                          <div className="flex justify-between items-center">
                            <div className="text-lg font-bold text-blue-900">
                              {service.priceString || 
                               (service.chargeType === 'fixed_rate' && service.fixedRate && `₦${formatPrice(service.fixedRate)}`) ||
                               (service.chargeType === 'hourly_rate' && service.hourlyRate && `₦${formatPrice(service.hourlyRate)}/hr`) ||
                               (service.price ? `₦${formatPrice(service.price)}` : 'Contact for price')}
                            </div>
                            {service.availability && (
                              <div className="flex items-center text-gray-600 text-sm">
                                <Clock size={16} className="mr-1 text-blue-500" />
                                <span>{service.availability}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>

                {/* Load More Button */}
                {hasMore && (
                  <div className="text-center mt-8">
                    <button 
                      onClick={loadMore}
                      disabled={isCurrentlyLoading}
                      className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center mx-auto disabled:bg-gray-400"
                    >
                      {isCurrentlyLoading ? (
                        <>
                          <Loader2 className="mr-2 animate-spin" size={20} />
                          Loading...
                        </>
                      ) : (
                        'Load More Services'
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

// Export the component wrapped with proximity filter
export default withProximityFilter(TradespeopleListings);