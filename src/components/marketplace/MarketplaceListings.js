'use client';
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { MapPin, Tag, Clock, Search as SearchIcon, Filter, X, Loader2 } from 'lucide-react';
import apiService from '@/services/api';
import { slugify } from '@/utils/slugify';
import { withProximityFilter } from '@/utils/withProximityFilter';
import { useGeolocationContext } from '@/context/GeolocationContext';
import MarketplaceListingCard from '@/components/marketplace/MarketplaceListingCard';
import { useSearchRecommendations } from '@/hooks/useSearchRecommendations';
import SearchDropdown from '@/components/shared/SearchDropdown';

function MarketplaceListings(props) {
  // Get proximity data and state from props and context
  const { data: proximityFilteredData, isLoading: isProximityLoading } = props;
  const { nearbyEnabled, searchRadius } = useGeolocationContext();
  
  // Search recommendations hook
  const {
    isOpen: isDropdownOpen,
    recommendations,
    isLoading: isRecommendationsLoading,
    handleFocus: handleSearchFocus,
    handleClose: handleDropdownClose,
    dropdownRef
  } = useSearchRecommendations('marketplace');
  
  // Local state for the component's own data management
  const [filteredItems, setFilteredItems] = useState([]);
  const [displayCount, setDisplayCount] = useState(12);
  const [isLocalLoading, setIsLocalLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMoreLocal, setHasMoreLocal] = useState(true);
  const [subcategory, setSubcategory] = useState('computers-laptops');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    condition: '',
    minPrice: '',
    maxPrice: '',
    paymentType: '',
    collectionType: ''
  });
  const [originalData, setOriginalData] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  
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
  // Load items function with support for the new filters
  const loadItems = async (reset = false) => {
    if (reset) {
      setFilteredItems([]);
      setDisplayCount(12);
    }

    setIsLocalLoading(true);
    setError(null);

    try {
      // Use API service to get marketplace items
      const response = await apiService.getMarketplaceItems({
        limit: 50,
        ...(searchQuery.trim() && { search: searchQuery.trim() }),
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to load marketplace items');
      }

      // Store total count from API
      setTotalCount(response.pagination?.total || 0);

      let allItems = (response.data || []).map(item => ({
        ...item,
        slug: item.slug || slugify(`${item.title}-${item.id}`)
      }));
      
      // Apply filters
      
      // Apply condition filter
      if (filters.condition) {
        allItems = allItems.filter(item => item.condition === filters.condition);
      }
      
      // Apply payment type filter
      if (filters.paymentType) {
        allItems = allItems.filter(item => item.paymentType === filters.paymentType);
      }
      
      // Apply collection type filter
      if (filters.collectionType) {
        allItems = allItems.filter(item => item.collectionType === filters.collectionType);
      }
      
      // Apply price filters
      if (filters.minPrice) {
        const minPriceValue = parseFloat(filters.minPrice);
        allItems = allItems.filter(item => {
          const price = extractPriceValue(item);
          return price >= minPriceValue;
        });
      }
      
      if (filters.maxPrice) {
        const maxPriceValue = parseFloat(filters.maxPrice);
        allItems = allItems.filter(item => {
          const price = extractPriceValue(item);
          return price <= maxPriceValue;
        });
      }
      
      // Store the original filtered results (before pagination)
      setOriginalData(allItems);
      
      // Apply pagination
      setFilteredItems(allItems.slice(0, displayCount));
      
      // Check if there are more items to load
      setHasMoreLocal(allItems.length > displayCount);
    } catch (error) {
      console.error('Error loading items:', error);
      setError('Failed to load items. Please try again later.');
    } finally {
      setIsLocalLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Reset filters function to include new fields
  const resetFilters = () => {
    setFilters({
      condition: '',
      minPrice: '',
      maxPrice: '',
      paymentType: '',
      collectionType: ''
    });
    setSearchQuery('');
    loadItems(true);
  };
  // Local pagination for when proximity filter is disabled
  const loadMoreLocal = () => {
    if (!isLocalLoading) {
      // Increase display count
      const newDisplayCount = displayCount + 12;
      setDisplayCount(newDisplayCount);
      
      // Update displayed items
      setFilteredItems(originalData.slice(0, newDisplayCount));
      
      // Check if there are more items to load
      setHasMoreLocal(originalData.length > newDisplayCount);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadItems(true);
  };

  const applyFilters = () => {
    loadItems(true);
  };

  // Function to format price with commas
  const formatPrice = (value) => {
    if (!value) return '';
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  // Function to parse price by removing commas
  const parsePrice = (value) => {
    if (!value) return '';
    return value.toString().replace(/,/g, '');
  };
  
  // Helper function to extract price from different formats
  const extractPriceValue = (item) => {
    // Try to get numeric price from various possible fields
    const itemPrice = 
      // First try price as a number
      (typeof item.price === 'number' ? item.price : null) ||
      // Then try priceNumeric field if it exists
      (item.priceNumeric) ||
      // Then try to extract numbers from priceString if it exists
      (item.priceString && typeof item.priceString === 'string' 
        ? parseFloat(item.priceString.replace(/[^0-9.]/g, '')) 
        : null) ||
      // Finally try to parse price as string
      (typeof item.price === 'string' 
        ? parseFloat(item.price.replace(/[^0-9.]/g, ''))
        : 0);
    
    return !isNaN(itemPrice) ? itemPrice : 0;
  };

  // Update the items grid to use the MarketplaceListingCard component
  const renderItemsGrid = () => {
    // Determine which data to use based on proximity filter
    const itemsToDisplay = nearbyEnabled ? proximityFilteredData : filteredItems;
    
    if (itemsToDisplay.length === 0) {
      return (
        <div className="text-center py-12 bg-gray-100 rounded-lg">
          <p className="text-gray-600 mb-4">
            {nearbyEnabled 
              ? 'No items found near your location' 
              : 'No items found matching your criteria'}
          </p>
          <button
            onClick={resetFilters}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Reset Filters
          </button>
        </div>
      );
    }
    
    return (
      <div className="grid md:grid-cols-3 gap-6">
        {itemsToDisplay.map((item) => (
          <MarketplaceListingCard 
            key={item.id} 
            item={item}
            showDistance={nearbyEnabled} 
          />
        ))}
      </div>
    );
  };
  // Update the active filters display to include the new fields
  const renderActiveFilters = () => {
    const hasActiveFilters = 
      filters.condition || 
      filters.minPrice || 
      filters.maxPrice || 
      filters.paymentType || 
      filters.collectionType || 
      searchQuery;
      
    if (!hasActiveFilters) return null;
    
    return (
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-gray-600">Active Filters:</span>
          
          {searchQuery && (
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
              Search: {searchQuery}
              <button 
                onClick={() => { setSearchQuery(''); loadItems(true); }} 
                className="hover:text-blue-600"
              >
                <X size={14} />
              </button>
            </span>
          )}
          
          {filters.condition && (
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
              Condition: {filters.condition}
              <button 
                onClick={() => { 
                  setFilters(prev => ({ ...prev, condition: '' })); 
                  loadItems(true);
                }} 
                className="hover:text-blue-600"
              >
                <X size={14} />
              </button>
            </span>
          )}
          
          {filters.paymentType && (
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
              Payment: {filters.paymentType === 'cash' ? 'Cash Only' : 
                        filters.paymentType === 'bank_transfer' ? 'Bank Transfer Only' : 
                        'Cash & Transfer'}
              <button 
                onClick={() => { 
                  setFilters(prev => ({ ...prev, paymentType: '' })); 
                  loadItems(true);
                }} 
                className="hover:text-blue-600"
              >
                <X size={14} />
              </button>
            </span>
          )}
          
          {filters.collectionType && (
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
              Collection: {filters.collectionType === 'pickup' ? 'Pickup Only' : 
                           filters.collectionType === 'delivery' ? 'Delivery Only' : 
                           'Pickup & Delivery'}
              <button 
                onClick={() => { 
                  setFilters(prev => ({ ...prev, collectionType: '' })); 
                  loadItems(true);
                }} 
                className="hover:text-blue-600"
              >
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
                  setFilters(prev => ({ ...prev, minPrice: '', maxPrice: '' }));
                  loadItems(true);
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
    );
  };
  
  // All marketplace subcategories
  const marketplaceSubcategories = {
    'computers-laptops': 'Computers & Laptops',
    'mobile-phones': 'Mobile Phones',
    'tablets': 'Tablets',
    'accessories-supplies': 'Accessories & Supplies',
    'furniture': 'Furniture'
  };
  
  // Initial load
  useEffect(() => {
    loadItems(true);
  }, [subcategory]);
  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-8">
          {/* Title */}
          <h1 className="text-3xl font-bold text-blue-900 mb-6">
            Marketplace - {marketplaceSubcategories[subcategory]}
          </h1>

          {/* Mobile Controls */}
          <div className="flex md:hidden items-center gap-2 mb-4">
            <button
              onClick={() => setIsCategoriesOpen(!isCategoriesOpen)}
              className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              title="Categories"
            >
              <Tag size={20} />
            </button>
          
            <button
              onClick={() => setIsFiltersOpen(!isFiltersOpen)}
              className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              title="Filters"
            >
              <Filter size={20} />
            </button>
          </div>

          {/* Categories */}
          <div className={`
            md:block
            ${isCategoriesOpen ? 'block' : 'hidden'}
          `}>
            <div className="flex flex-wrap gap-2 mb-6">
              {/* Categories */}
              {Object.entries(marketplaceSubcategories).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => {
                    setSubcategory(key);
                    setIsCategoriesOpen(false);
                  }}
                  className={`
                    px-4 py-2 rounded-full text-sm font-medium transition-colors
                    ${subcategory === key 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
                  `}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="mb-6 flex gap-2">
            <div className="relative flex-grow" ref={searchInputRef}>
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <SearchIcon className="text-gray-400" size={20} />
              </div>
              <input
                type="text"
                placeholder="Search marketplace items..."
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
          {/* Filters Section */}
          <div className={`md:block ${isFiltersOpen ? 'block' : 'hidden'}`}>
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="grid md:grid-cols-2 gap-4">
                {/* Product Condition filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
                  <select
                    name="condition"
                    value={filters.condition}
                    onChange={handleFilterChange}
                    className="w-full p-2 border rounded-lg"
                  >
                    <option value="">All Conditions</option>
                    <option value="Brand New">Brand New</option>
                    <option value="Like New">Like New</option>
                    <option value="Excellent">Excellent</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                    <option value="For Parts">For Parts</option>
                  </select>
                </div>

                {/* Payment Type filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                  <select
                    name="paymentType"
                    value={filters.paymentType}
                    onChange={handleFilterChange}
                    className="w-full p-2 border rounded-lg"
                  >
                    <option value="">Any Payment Method</option>
                    <option value="cash">Cash Only</option>
                    <option value="bank_transfer">Bank Transfer Only</option>
                    <option value="cash_and_transfer">Cash & Bank Transfer</option>
                  </select>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {/* Collection Type filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Collection</label>
                  <select
                    name="collectionType"
                    value={filters.collectionType}
                    onChange={handleFilterChange}
                    className="w-full p-2 border rounded-lg"
                  >
                    <option value="">Any Collection Method</option>
                    <option value="pickup">Pickup Only</option>
                    <option value="delivery">Delivery Only</option>
                    <option value="pickup_and_delivery">Pickup & Delivery</option>
                  </select>
                </div>

                {/* Price Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price Range</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      name="minPrice"
                      placeholder="Min"
                      value={formatPrice(filters.minPrice)}
                      onChange={(e) => {
                        const value = parsePrice(e.target.value);
                        if (value === '' || /^\d*$/.test(value)) {
                          handleFilterChange({
                            target: { name: 'minPrice', value }
                          });
                        }
                      }}
                      className="w-1/2 p-2 border rounded-lg"
                    />
                    <input
                      type="text"
                      name="maxPrice"
                      placeholder="Max"
                      value={formatPrice(filters.maxPrice)}
                      onChange={(e) => {
                        const value = parsePrice(e.target.value);
                        if (value === '' || /^\d*$/.test(value)) {
                          handleFilterChange({
                            target: { name: 'maxPrice', value }
                          });
                        }
                      }}
                      className="w-1/2 p-2 border rounded-lg"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mb-4">
              <button
                onClick={resetFilters}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Reset
              </button>
              
              <button
                onClick={applyFilters}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* Active Filters */}
      {renderActiveFilters()}

      {/* Items Grid */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Loading State - use the appropriate loading indicator based on proximity */}
        {(nearbyEnabled ? isProximityLoading : isLocalLoading) ? (
          <div className="grid place-items-center min-h-[50vh]">
            <div className="text-center">
              <Loader2 className="w-16 h-16 animate-spin text-blue-500 mx-auto mb-4" />
              <p className="text-gray-600">
                {nearbyEnabled ? 'Finding items near you...' : 'Loading items...'}
              </p>
              {nearbyEnabled && (
                <p className="text-sm text-gray-500 mt-2">
                  Searching within {searchRadius}km radius
                </p>
              )}
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-12 bg-red-50 rounded-lg">
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={() => loadItems(true)}
              className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              Try Again
            </button>
          </div>
        ) : (
          <>
            {/* Listing count and Post button */}
            {(nearbyEnabled ? proximityFilteredData : filteredItems).length > 0 && (
              <div className="mb-6 flex justify-between items-center">
                <p className="text-sm text-gray-600">
                  Showing {(nearbyEnabled ? proximityFilteredData : filteredItems).length} of {totalCount} results
                </p>
                <Link
                  href="/dashboard?tab=post-ad&type=marketplace"
                  className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                  Post Marketplace Listing
                </Link>
              </div>
            )}

            {/* Render Items Grid */}
            {renderItemsGrid()}

            {/* Load More Button */}
            {(nearbyEnabled ? props.hasMore : hasMoreLocal) && (
              <div className="text-center mt-8">
                <button
                  onClick={nearbyEnabled ? () => {} : loadMoreLocal}
                  disabled={(nearbyEnabled ? isProximityLoading : isLocalLoading)}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                >
                  {(nearbyEnabled ? isProximityLoading : isLocalLoading) ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Loading...
                    </span>
                  ) : (
                    'Load More'
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Export with HOC
export default withProximityFilter(MarketplaceListings);