// components/property/PropertyFilters.js
import React, { useState } from 'react';
import { X } from 'lucide-react';

const propertyTypes = [
  { value: '', label: 'All Types' },
  { value: 'house', label: 'House' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'land', label: 'Land' },
  { value: 'commercial', label: 'Commercial' }
];

// Listing type options (rent vs sale)
const listingTypes = [
  { value: '', label: 'All Listings' },
  { value: 'rent', label: 'For Rent' },
  { value: 'sale', label: 'For Sale' }
];

export default React.memo(function PropertyFilters({ 
  filters, 
  setFilters, 
  onResetFilters, 
  isFilterOpen, 
  setIsFilterOpen 
}) {
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

  const removeFilter = (filterName) => {
    setFilters(prev => ({ ...prev, [filterName]: '' }));
  };

  const removeMultipleFilters = (filterNames) => {
    setFilters(prev => {
      const updated = { ...prev };
      filterNames.forEach(name => {
        updated[name] = '';
      });
      return updated;
    });
  };

  return (
    <>
      {/* Advanced Filters */}
      {isFilterOpen && (
        <div 
          className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200"
          role="region"
          aria-label="Property filters"
        >
          <div className="grid md:grid-cols-3 gap-4">
            {/* Listing Type (Rent vs Sale) - NEW */}
            <div className="space-y-2">
              <label htmlFor="listingType" className="block text-sm font-medium text-gray-700">
                Listing Type
              </label>
              <select 
                id="listingType"
                name="listingType"
                value={filters.listingType}
                onChange={handleFilterChange}
                className="w-full p-2 border rounded-lg bg-white text-gray-900 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                aria-describedby="listingType-help"
              >
                {listingTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Price Range */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Price Range
              </label>
              <div id="priceRange-help" className="sr-only">
                Enter minimum and maximum price range for properties
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  id="minPrice"
                  name="minPrice"
                  value={formatPrice(filters.minPrice)}
                  placeholder="Min Price"
                  onChange={handleFilterChange}
                  className="p-2 border rounded-lg bg-white text-gray-900 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  aria-label="Minimum price"
                  aria-describedby="priceRange-help"
                />
                <input
                  type="text"
                  id="maxPrice"
                  name="maxPrice"
                  value={formatPrice(filters.maxPrice)}
                  placeholder="Max Price"
                  onChange={handleFilterChange}
                  className="p-2 border rounded-lg bg-white text-gray-900 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  aria-label="Maximum price"
                  aria-describedby="priceRange-help"
                />
              </div>
            </div>

            {/* Property Type */}
            <div className="space-y-2">
              <label htmlFor="propertyType" className="block text-sm font-medium text-gray-700">
                Property Type
              </label>
              <select 
                id="propertyType"
                name="propertyType"
                value={filters.propertyType}
                onChange={handleFilterChange}
                className="w-full p-2 border rounded-lg bg-white text-gray-900 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                aria-describedby="propertyType-help"
              >
                {propertyTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <label htmlFor="location" className="block text-sm font-medium text-gray-700">
                Location
              </label>
              <input
                type="text"
                id="location"
                name="location"
                value={filters.location}
                placeholder="Enter location (e.g., Lagos, Abuja)"
                onChange={handleFilterChange}
                className="w-full p-2 border rounded-lg bg-white text-gray-900 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                aria-label="Property location"
                aria-describedby="location-help"
              />
              <div id="location-help" className="sr-only">
                Enter the city or area where you want to search for properties
              </div>
            </div>

            {/* Bedrooms & Bathrooms */}
            <div className="space-y-2">
              <label htmlFor="bedrooms" className="block text-sm font-medium text-gray-700">
                Bedrooms
              </label>
              <select 
                id="bedrooms"
                name="bedrooms"
                value={filters.bedrooms}
                onChange={handleFilterChange}
                className="w-full p-2 border rounded-lg bg-white text-gray-900 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                aria-label="Number of bedrooms"
              >
                <option value="">Any</option>
                {[1, 2, 3, 4, 5, '5+'].map((num) => (
                  <option key={num} value={num}>
                    {num} {num === 1 ? 'Bedroom' : 'Bedrooms'}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="bathrooms" className="block text-sm font-medium text-gray-700">
                Bathrooms
              </label>
              <select 
                id="bathrooms"
                name="bathrooms"
                value={filters.bathrooms}
                onChange={handleFilterChange}
                className="w-full p-2 border rounded-lg bg-white text-gray-900 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                aria-label="Number of bathrooms"
              >
                <option value="">Any</option>
                {[1, 2, 3, 4, '4+'].map((num) => (
                  <option key={num} value={num}>
                    {num} {num === 1 ? 'Bathroom' : 'Bathrooms'}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Actions */}
            <div className="md:col-span-3 flex justify-end gap-4 mt-4">
              <button
                type="button"
                onClick={onResetFilters}
                className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                aria-label="Reset all filters to default values"
              >
                Reset Filters
              </button>
              <div className="text-sm text-gray-600 flex items-center">
                Filters apply automatically as you change them
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Filters Display */}
      {(filters.listingType || filters.propertyType || filters.location || filters.bedrooms || filters.bathrooms || filters.minPrice || filters.maxPrice) && (
        <div className="mt-4 py-2">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-gray-600">Active Filters:</span>
            
            {/* Listing Type Filter Badge - NEW */}
            {filters.listingType && (
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
                {filters.listingType === 'rent' ? 'For Rent' : 'For Sale'}
                <button 
                  onClick={() => removeFilter('listingType')} 
                  className="hover:text-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded"
                  aria-label="Remove listing type filter"
                >
                  <X size={14} />
                </button>
              </span>
            )}
            
            {filters.propertyType && (
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
                Type: {propertyTypes.find(t => t.value === filters.propertyType)?.label}
                <button 
                  onClick={() => removeFilter('propertyType')} 
                  className="hover:text-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded"
                  aria-label="Remove property type filter"
                >
                  <X size={14} />
                </button>
              </span>
            )}
            
            {filters.location && (
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
                Location: {filters.location}
                <button 
                  onClick={() => removeFilter('location')} 
                  className="hover:text-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded"
                  aria-label="Remove location filter"
                >
                  <X size={14} />
                </button>
              </span>
            )}
            
            {filters.bedrooms && (
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
                {filters.bedrooms} {Number(filters.bedrooms) === 1 ? 'Bedroom' : 'Bedrooms'}
                <button 
                  onClick={() => removeFilter('bedrooms')} 
                  className="hover:text-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded"
                  aria-label="Remove bedrooms filter"
                >
                  <X size={14} />
                </button>
              </span>
            )}
            
            {filters.bathrooms && (
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
                {filters.bathrooms} {Number(filters.bathrooms) === 1 ? 'Bathroom' : 'Bathrooms'}
                <button 
                  onClick={() => removeFilter('bathrooms')} 
                  className="hover:text-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded"
                  aria-label="Remove bathrooms filter"
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
                  onClick={() => removeMultipleFilters(['minPrice', 'maxPrice'])}
                  className="hover:text-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded"
                  aria-label="Remove price range filter"
                >
                  <X size={14} />
                </button>
              </span>
            )}
            
            <button
              onClick={onResetFilters}
              className="text-blue-500 hover:text-blue-600 text-sm ml-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-2 py-1"
              aria-label="Clear all active filters"
            >
              Clear All
            </button>
          </div>
        </div>
      )}
    </>
  );
});