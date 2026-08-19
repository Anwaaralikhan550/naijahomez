'use client';
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { MapPin, Bed, Bath, Tag, Filter, X, Loader2, ShoppingCart, Wrench, Home, SearchX, RotateCcw, Star } from 'lucide-react';
import apiService from '@/services/api';
import { slugify } from '@/utils/slugify';
import SponsoredAdSlot from '@/components/advertising/SponsoredAdSlot';
import { trackJourneyStep } from '@/lib/analytics/events';
import { SourceWatermarkCover, shouldForceSourceWatermark } from '@/components/property/ImageGallery';

// Property Types Constant - For property search
const PROPERTY_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'house', label: 'House' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'land', label: 'Land' },
  { value: 'commercial', label: 'Commercial' }
];

// Marketplace Categories Constant - For marketplace search
const MARKETPLACE_CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'computers-laptops', label: 'Computers & Laptops' },
  { value: 'mobile-phones', label: 'Mobile Phones' },
  { value: 'tablets', label: 'Tablets' },
  { value: 'accessories-supplies', label: 'Accessories & Supplies' },
  { value: 'furniture', label: 'Furniture' }
];

// Service Categories Constant - For services search
const SERVICE_CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'plumber', label: 'Plumbers' },
  { value: 'electrician', label: 'Electricians' },
  { value: 'carpenter', label: 'Carpenters' },
  { value: 'painter', label: 'Painters' },
  { value: 'generator-repair', label: 'Generator Repair' },
  { value: 'ac-repair', label: 'AC Repair' }
];


export default function SearchPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('q') || '';
  
  const [activeTab, setActiveTab] = useState('property');
  const [isLoading, setIsLoading] = useState(true);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // State for filters - separated by type
  const [propertyFilters, setPropertyFilters] = useState({
    minPrice: '',
    maxPrice: '',
    bedrooms: '',
    bathrooms: '',
    location: '',
    propertyType: ''
  });
  
  const [marketplaceFilters, setMarketplaceFilters] = useState({
    minPrice: '',
    maxPrice: '',
    condition: '',
    category: ''
  });
  
  const [serviceFilters, setServiceFilters] = useState({
    category: '',
    rating: ''
  });

  useEffect(() => {
    trackJourneyStep('search', {
      source: 'search_page',
      listingType: activeTab,
      location: propertyFilters.location || searchQuery
    });
  }, [activeTab, propertyFilters.location, searchQuery]);

  // Get current active filters based on tab
  const getActiveFilters = () => {
    switch(activeTab) {
      case 'property':
        return propertyFilters;
      case 'marketplace':
        return marketplaceFilters;
      case 'service':
        return serviceFilters;
      default:
        return {};
    }
  };

  // Set current active filters based on tab
  const setActiveFilters = (updatedFilters) => {
    switch(activeTab) {
      case 'property':
        setPropertyFilters(updatedFilters);
        break;
      case 'marketplace':
        setMarketplaceFilters(updatedFilters);
        break;
      case 'service':
        setServiceFilters(updatedFilters);
        break;
    }
  };

  // Handle filter change
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    const currentFilters = getActiveFilters();
    
    setActiveFilters({
      ...currentFilters,
      [name]: value
    });
  };

  // Reset filters for current tab
  const resetFilters = () => {
    switch(activeTab) {
      case 'property':
        setPropertyFilters({
          minPrice: '',
          maxPrice: '',
          bedrooms: '',
          bathrooms: '',
          location: '',
          propertyType: ''
        });
        break;
      case 'marketplace':
        setMarketplaceFilters({
          minPrice: '',
          maxPrice: '',
          condition: '',
          category: ''
        });
        break;
      case 'service':
        setServiceFilters({
          category: '',
          rating: ''
        });
        break;
    }
    
    // Re-run search with reset filters
    search();
  };

  // Remove a single filter
  const removeFilter = (filterName) => {
    const currentFilters = getActiveFilters();
    setActiveFilters({
      ...currentFilters,
      [filterName]: ''
    });
    
    // Re-run search after removing filter
    search();
  };

  // Format price with commas
  const formatPrice = (value) => {
    if (!value) return '';
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  // Parse price by removing commas
  const parsePrice = (value) => {
    if (!value) return '';
    return value.toString().replace(/,/g, '');
  };

  const parseDateValue = (value) => {
    if (!value) return null;
    if (value?.toDate && typeof value.toDate === 'function') return value.toDate();
    if (value?.seconds) return new Date(value.seconds * 1000);
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const isPromotedActive = (item) => {
    if (!item?.isPromoted) return false;
    const expiry = parseDateValue(item?.promotionExpiry);
    if (!expiry) return true;
    return expiry.getTime() > Date.now();
  };

  // Initial search on load and when tab changes
  useEffect(() => {
    if (searchQuery) {
      search();
    } else {
      setResults([]);
      setIsLoading(false);
    }
  }, [searchQuery, activeTab]);

  // Main search function
  const search = async () => {
    if (!searchQuery.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }
  
    setIsLoading(true);
    setError(null);
  
    try {
      let searchResults = [];
      const searchTermLower = searchQuery.toLowerCase();
      
      // Get current filters
      const filters = getActiveFilters();
      
      // Different search logic based on tab
      switch(activeTab) {
        case 'property':
          searchResults = await searchProperties(searchTermLower, filters);
          break;
        case 'marketplace':
          searchResults = await searchMarketplace(searchTermLower, filters);
          break;
        case 'service':
          searchResults = await searchServices(searchTermLower, filters);
          break;
      }
      
      // Set the results directly - don't filter further at this point
      setResults(searchResults);
    } catch (error) {
      console.error('Search error:', error);
      setError('An error occurred while searching. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Property search function
  const searchProperties = async (searchTerm, filters) => {
    // Use API service to get properties with search
    const response = await apiService.getProperties({
      search: searchTerm,
      limit: 50,
      ...(filters.propertyType && { propertyType: filters.propertyType }),
      ...(filters.minPrice && { minPrice: filters.minPrice }),
      ...(filters.maxPrice && { maxPrice: filters.maxPrice })
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to search properties');
    }
    
    // Get all properties and ensure proper format
    let properties = (response.data || []).map(property => {
      return {
        ...property,
        type: 'property',
        slug: property.slug || slugify(`${property.title}-${property.id}`)
      };
    });
    
    // Filter by search term
    properties = properties.filter(property => 
      (property.title && property.title.toLowerCase().includes(searchTerm)) ||
      (property.location && property.location.toLowerCase().includes(searchTerm)) ||
      (property.description && property.description.toLowerCase().includes(searchTerm))
    );
    
    // Apply property-specific filters
    if (filters.propertyType) {
      properties = properties.filter(property => 
        (property.propertyType || property.type) === filters.propertyType
      );
    }
    
    if (filters.bedrooms) {
      const bedroomsValue = parseInt(filters.bedrooms);
      properties = properties.filter(property => {
        const propertyBedrooms = typeof property.bedrooms === 'number' 
          ? property.bedrooms 
          : parseInt(property.bedrooms || 0);
        return propertyBedrooms === bedroomsValue;
      });
    }
    
    if (filters.bathrooms) {
      const bathroomsValue = parseInt(filters.bathrooms);
      properties = properties.filter(property => {
        const propertyBathrooms = typeof property.bathrooms === 'number' 
          ? property.bathrooms 
          : parseInt(property.bathrooms || 0);
        return propertyBathrooms === bathroomsValue;
      });
    }
    
    if (filters.location) {
      const locationLower = filters.location.toLowerCase();
      properties = properties.filter(property => 
        property.location && 
        property.location.toLowerCase().includes(locationLower)
      );
    }
    
    // Filter out properties without images (for display)
    const validProperties = properties.filter(property => 
      property.imageUrls && property.imageUrls.length > 0
    );
    
    // Return only the valid properties to match the display count
    return validProperties;
  };

  // Marketplace search function
  const searchMarketplace = async (searchTerm, filters) => {
    // Use API service to get marketplace items with search
    const response = await apiService.getMarketplaceItems({
      search: searchTerm,
      limit: 50,
      ...(filters.category && { category: filters.category })
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to search marketplace');
    }
    
    // Get all items and ensure proper format
    let items = (response.data || []).map(item => {
      return {
        ...item,
        type: 'marketplace',
        slug: item.slug || slugify(`${item.title}-${item.id}`)
      };
    });
    
    // Filter by search term
    items = items.filter(item => 
      (item.title && item.title.toLowerCase().includes(searchTerm)) ||
      (item.location && item.location.toLowerCase().includes(searchTerm)) ||
      (item.description && item.description.toLowerCase().includes(searchTerm))
    );
    
    // Apply condition filter
    if (filters.condition) {
      items = items.filter(item => item.condition === filters.condition);
    }
    
    // Filter out items without images (for display)
    return items.filter(item => 
      item.imageUrls && item.imageUrls.length > 0
    );
  };

  // Services search function
  const searchServices = async (searchTerm, filters) => {
    // Use API service to get tradespeople/services with search
    const response = await apiService.getTradespeople({
      search: searchTerm,
      limit: 50,
      ...(filters.category && { serviceType: filters.category })
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to search services');
    }
    
    // Get all services and ensure proper format
    let services = (response.data || []).map(service => {
      return {
        ...service,
        type: 'service',
        slug: service.slug || slugify(`${service.title}-${service.id}`)
      };
    });
    
    // Filter by search term
    services = services.filter(service => 
      (service.title && service.title.toLowerCase().includes(searchTerm)) ||
      (service.location && service.location.toLowerCase().includes(searchTerm)) ||
      (service.description && service.description.toLowerCase().includes(searchTerm)) ||
      (service.provider && service.provider.toLowerCase().includes(searchTerm))
    );
    
    // Apply rating filter
    if (filters.rating) {
      const ratingValue = parseFloat(filters.rating);
      services = services.filter(service => 
        service.rating >= ratingValue
      );
    }
    
    // Filter out services without images (for display)
    return services.filter(service => 
      service.imageUrls && service.imageUrls.length > 0
    );
  };

  // Apply filters button handler
  const applyFilters = () => {
    search();
  };

  const clearSearchAndReset = () => {
    setPropertyFilters({
      minPrice: '',
      maxPrice: '',
      bedrooms: '',
      bathrooms: '',
      location: '',
      propertyType: ''
    });
    setMarketplaceFilters({
      minPrice: '',
      maxPrice: '',
      condition: '',
      category: ''
    });
    setServiceFilters({
      category: '',
      rating: ''
    });
    setIsFilterOpen(false);
    setResults([]);
    setError(null);
    router.push(pathname);
  };

  // Helper function to get filter options based on active tab
  const getFilterOptions = () => {
    switch(activeTab) {
      case 'property':
        return (
          <>
            {/* Property Type */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Property Type</label>
              <select 
                name="propertyType"
                value={propertyFilters.propertyType}
                onChange={handleFilterChange}
                className="w-full p-2 border rounded-lg bg-white text-gray-900"
              >
                {PROPERTY_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Bedrooms */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Bedrooms</label>
              <select 
                name="bedrooms"
                value={propertyFilters.bedrooms}
                onChange={handleFilterChange}
                className="w-full p-2 border rounded-lg bg-white text-gray-900"
              >
                <option value="">Any</option>
                {[1, 2, 3, 4, 5].map((num) => (
                  <option key={num} value={num}>
                    {num} {num === 1 ? 'Bedroom' : 'Bedrooms'}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Bathrooms */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Bathrooms</label>
              <select 
                name="bathrooms"
                value={propertyFilters.bathrooms}
                onChange={handleFilterChange}
                className="w-full p-2 border rounded-lg bg-white text-gray-900"
              >
                <option value="">Any</option>
                {[1, 2, 3, 4].map((num) => (
                  <option key={num} value={num}>
                    {num} {num === 1 ? 'Bathroom' : 'Bathrooms'}
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
                value={propertyFilters.location}
                onChange={handleFilterChange}
                placeholder="Enter location"
                className="w-full p-2 border rounded-lg bg-white text-gray-900 placeholder-gray-500"
              />
            </div>
          </>
        );
        
      case 'marketplace':
        return (
          <>
            {/* Marketplace Category */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Category</label>
              <select 
                name="category"
                value={marketplaceFilters.category}
                onChange={handleFilterChange}
                className="w-full p-2 border rounded-lg bg-white text-gray-900"
              >
                {MARKETPLACE_CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Condition */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Condition</label>
              <select 
                name="condition"
                value={marketplaceFilters.condition}
                onChange={handleFilterChange}
                className="w-full p-2 border rounded-lg bg-white text-gray-900"
              >
                <option value="">Any</option>
                <option value="new">New</option>
                <option value="like-new">Like New</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
              </select>
            </div>
          </>
        );
        
      case 'service':
        return (
          <>
            {/* Service Category */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Service Type</label>
              <select 
                name="category"
                value={serviceFilters.category}
                onChange={handleFilterChange}
                className="w-full p-2 border rounded-lg bg-white text-gray-900"
              >
                {SERVICE_CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Rating */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Minimum Rating</label>
              <select 
                name="rating"
                value={serviceFilters.rating}
                onChange={handleFilterChange}
                className="w-full p-2 border rounded-lg bg-white text-gray-900"
              >
                <option value="">Any Rating</option>
                <option value="4.5">4.5+ Stars</option>
                <option value="4">4+ Stars</option>
                <option value="3.5">3.5+ Stars</option>
                <option value="3">3+ Stars</option>
              </select>
            </div>
          </>
        );
        
      default:
        return null;
    }
  };

  // Helper to render active filters
  const renderActiveFilters = () => {
    const filters = getActiveFilters();
    const hasActiveFilters = Object.values(filters).some(value => value !== '');
    
    if (!hasActiveFilters) return null;
    
    return (
      <div className="flex flex-wrap gap-2 items-center mt-4">
        <span className="text-gray-600">Active Filters:</span>
        
        {activeTab === 'property' && filters.propertyType && (
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
            Type: {PROPERTY_TYPES.find(t => t.value === filters.propertyType)?.label}
            <button onClick={() => removeFilter('propertyType')} className="hover:text-blue-600">
              <X size={14} />
            </button>
          </span>
        )}
        
        {activeTab === 'property' && filters.bedrooms && (
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
            {filters.bedrooms} {Number(filters.bedrooms) === 1 ? 'Bedroom' : 'Bedrooms'}
            <button onClick={() => removeFilter('bedrooms')} className="hover:text-blue-600">
              <X size={14} />
            </button>
          </span>
        )}
        
        {activeTab === 'property' && filters.bathrooms && (
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
            {filters.bathrooms} {Number(filters.bathrooms) === 1 ? 'Bathroom' : 'Bathrooms'}
            <button onClick={() => removeFilter('bathrooms')} className="hover:text-blue-600">
              <X size={14} />
            </button>
          </span>
        )}
        
        {activeTab === 'property' && filters.location && (
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
            Location: {filters.location}
            <button onClick={() => removeFilter('location')} className="hover:text-blue-600">
              <X size={14} />
            </button>
          </span>
        )}
        
        {activeTab === 'marketplace' && filters.category && (
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
            Category: {MARKETPLACE_CATEGORIES.find(c => c.value === filters.category)?.label}
            <button onClick={() => removeFilter('category')} className="hover:text-blue-600">
              <X size={14} />
            </button>
          </span>
        )}
        
        {activeTab === 'marketplace' && filters.condition && (
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
            Condition: {filters.condition}
            <button onClick={() => removeFilter('condition')} className="hover:text-blue-600">
              <X size={14} />
            </button>
          </span>
        )}
        
        {activeTab === 'service' && filters.category && (
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
            Type: {SERVICE_CATEGORIES.find(c => c.value === filters.category)?.label}
            <button onClick={() => removeFilter('category')} className="hover:text-blue-600">
              <X size={14} />
            </button>
          </span>
        )}
        
        {activeTab === 'service' && filters.rating && (
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
            Rating: {filters.rating}+ Stars
            <button onClick={() => removeFilter('rating')} className="hover:text-blue-600">
              <X size={14} />
            </button>
          </span>
        )}
        
        <button
          onClick={resetFilters}
          className="text-blue-500 hover:text-blue-600 text-sm"
        >
          Clear All
        </button>
      </div>
    );
  };

  // Render item based on type
  const renderItem = (item) => {
    switch(item.type) {
      case 'property':
        return (
          <Link href={`/property/${item.slug}`} key={item.id} className="group block h-full">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden h-full flex flex-col">
              <div className="relative">
                <img
                  src={item.imageUrls?.[0] || '/api/placeholder/400/300'}
                  alt={item.title}
                  className="w-full h-48 object-cover"
                  loading="lazy"
                />
                <SourceWatermarkCover
                  imageUrl={item.imageUrls?.[0]}
                  force={shouldForceSourceWatermark(item)}
                />
                {item.type && (
                  <div className="absolute top-4 right-4 bg-blue-500 text-white px-3 py-1 rounded-full text-sm">
                    {item.type}
                  </div>
                )}
              </div>
              <div className="p-4 flex flex-col flex-1">
                <h3 className="text-lg font-bold text-blue-900 mb-2 line-clamp-2 min-h-[3.5rem]">
                  {item.title}
                </h3>
                <div className="flex items-center text-gray-600 mb-2">
                  <MapPin size={16} className="mr-1" />
                  <span className="line-clamp-1">{item.location}</span>
                </div>
                <div className="flex justify-between items-center mt-auto">
                  <div className="text-lg font-bold text-blue-900">
                    {item.rate || item.price}
                  </div>
                  <div className="flex space-x-2">
                    {item.bedrooms && (
                      <div className="flex items-center text-gray-600">
                        <Bed size={16} className="mr-1" />
                        <span>{item.bedrooms}</span>
                      </div>
                    )}
                    {item.bathrooms && (
                      <div className="flex items-center text-gray-600">
                        <Bath size={16} className="mr-1" />
                        <span>{item.bathrooms}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Link>
        );
        
      case 'marketplace':
        return (
          <Link href={`/marketplace/${item.slug}`} key={item.id} className="group block h-full">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden h-full flex flex-col">
              <div className="relative">
                <img
                  src={item.imageUrls?.[0] || '/api/placeholder/400/300'}
                  alt={item.title}
                  className="w-full h-48 object-cover"
                  loading="lazy"
                />
                {item.condition && (
                  <div className="absolute top-4 right-4 bg-orange-100 text-orange-600 px-2 py-1 rounded-full text-sm">
                    {item.condition}
                  </div>
                )}
              </div>
              <div className="p-4 flex flex-col flex-1">
                <h3 className="text-lg font-bold text-blue-900 mb-2 line-clamp-2 min-h-[3.5rem]">
                  {item.title}
                </h3>
                <div className="flex items-center text-gray-600 mb-2">
                  <MapPin size={16} className="mr-1" />
                  <span className="line-clamp-1">{item.location}</span>
                </div>
                <div className="text-lg font-bold text-blue-900 mt-auto">
                  {item.priceString || item.price}
                </div>
              </div>
            </div>
          </Link>
        );
        
      case 'service':
        return (
          <Link href={`/tradespeople/${item.slug}`} key={item.id} className="group block h-full">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden h-full flex flex-col">
              <div className="relative">
                <img
                  src={item.imageUrls?.[0] || '/api/placeholder/400/300'}
                  alt={item.title}
                  className="w-full h-48 object-cover"
                  loading="lazy"
                />
                {item.serviceType && (
                  <div className="absolute top-4 right-4 bg-blue-500 text-white px-2 py-1 rounded-full text-sm">
                    {item.serviceType}
                  </div>
                )}
              </div>
              <div className="p-4 flex flex-col flex-1">
                <h3 className="text-lg font-bold text-blue-900 mb-2 line-clamp-2 min-h-[3.5rem]">
                  {item.title}
                </h3>
                {item.provider && (
                  <p className="text-gray-600 mb-2 line-clamp-1 min-h-6">{item.provider}</p>
                )}
                <div className="flex items-center text-gray-600 mb-2">
                  <MapPin size={16} className="mr-1" />
                  <span className="line-clamp-1">{item.location}</span>
                </div>
                <div className="mt-auto">
                  {item.rating && (
                    <div className="flex items-center gap-1 mb-2">
                      <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                      </svg>
                      <span className="font-medium">{item.rating}</span>
                      {item.reviewCount && (
                        <span className="text-gray-500 text-sm">({item.reviewCount})</span>
                      )}
                    </div>
                  )}
                  <div className="text-lg font-bold text-blue-900">
                    {item.priceString || item.price}
                  </div>
                </div>
              </div>
            </div>
          </Link>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-white shadow-sm sticky top-14 md:top-16 lg:top-20 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-blue-900 mb-4">
            Search Results for "{searchQuery}"
          </h1>
          
          {/* Category Tabs */}
          <div className="flex border-b overflow-x-auto">
            <button
              onClick={() => setActiveTab('property')}
              className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${
                activeTab === 'property'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Home size={20} />
                <span>Properties</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('marketplace')}
              className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${
                activeTab === 'marketplace'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <ShoppingCart size={20} />
                <span>Marketplace</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('service')}
              className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${
                activeTab === 'service'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Wrench size={20} />
                <span>Services</span>
              </div>
            </button>
          </div>
          
          {/* Filter Button */}
          <div className="mt-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <p className="text-gray-600">
            {results.length} result{results.length !== 1 ? 's' : ''} found
          </p>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/dashboard?tab=my-ads&action=promote&type=${activeTab === 'property' ? 'property' : activeTab === 'marketplace' ? 'marketplace' : 'services'}`}
                className="inline-flex items-center gap-1 px-3 py-2 bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200 transition-colors text-sm min-h-[44px]"
              >
                <Star size={14} />
                Promote Listing
              </Link>
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className="flex-shrink-0 bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 touch-target min-h-[44px] min-w-[44px] justify-center"
              >
                <Filter size={20} />
                <span className="hidden sm:inline">{isFilterOpen ? 'Hide Filters' : 'Show Filters'}</span>
              </button>
            </div>
          </div>
          
          {/* Filters Panel */}
          {isFilterOpen && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">Filters</h2>
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(false)}
                  aria-label="Close filters panel"
                  className="inline-flex items-center justify-center rounded-lg p-2 text-blue-600 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                {/* Dynamic Filter Options based on active tab */}
                {getFilterOptions()}
                
                {/* Filter Actions */}
                <div className="md:col-span-3 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 mt-4">
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="w-full sm:w-auto py-2 px-4 rounded-lg font-medium border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    Reset Filters
                  </button>
                  <button
                    type="button"
                    onClick={applyFilters}
                    className="w-full sm:w-auto py-2 px-4 rounded-lg font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Active Filters */}
          {renderActiveFilters()}
        </div>
      </div>
      
      {/* Search Results */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex justify-center items-center min-h-[400px]">
            <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
          </div>
        ) : error ? (
          <div className="text-center py-12 bg-red-50 rounded-lg">
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={search}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Try Again
            </button>
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-14 px-6 bg-white rounded-2xl border border-blue-100 shadow-sm">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-50 flex items-center justify-center">
              <SearchX className="w-8 h-8 text-blue-500" />
            </div>
            <h3 className="text-2xl font-semibold text-gray-800 mb-2">
              No {activeTab === 'property' ? 'properties' : activeTab === 'marketplace' ? 'items' : 'services'} found
            </h3>
            <p className="text-gray-600 max-w-2xl mx-auto">
              No results matched your search for "{searchQuery}". Try clearing filters or searching with broader keywords.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                <RotateCcw size={16} />
                Reset Filters
              </button>
              <button
                type="button"
                onClick={clearSearchAndReset}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <X size={16} />
                Clear Search
              </button>
            </div>
          </div>
        ) : (
          <>
            {results.some((item) => isPromotedActive(item)) && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-center gap-2 mb-3 text-amber-800 text-sm font-semibold">
                  <Star size={14} />
                  Sponsored Results
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  {results
                    .filter((item) => isPromotedActive(item))
                    .slice(0, 3)
                    .map((item) => (
                      <Link
                        key={`sponsored-${item.id}`}
                        href={`/${item.type === 'property' ? 'property' : item.type === 'marketplace' ? 'marketplace' : 'tradespeople'}/${item.slug || item.id}`}
                        className="bg-white rounded-lg border border-amber-100 p-3 hover:shadow-sm transition-shadow h-full flex flex-col"
                      >
                        <p className="text-sm font-semibold text-blue-900 line-clamp-2 min-h-10">{item.title}</p>
                        <p className="text-xs text-gray-600 line-clamp-1 mt-1">{item.location || item.provider}</p>
                        <p className="text-sm font-bold text-blue-800 mt-auto pt-2">{item.priceString || item.price || item.rate || 'View details'}</p>
                      </Link>
                    ))}
                </div>
              </div>
            )}
            <SponsoredAdSlot
              slot="search_sponsored_card"
              location={getActiveFilters().location || searchQuery}
              propertyCategory={getActiveFilters().propertyType || getActiveFilters().category || activeTab}
              variant="card"
              className="mb-6"
            />
            <div className="grid md:grid-cols-3 gap-6">
              {results.map(item => renderItem(item))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
