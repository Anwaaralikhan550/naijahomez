'use client';
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Clock, Search as SearchIcon, Filter, X, Loader2, Tag, Star, Megaphone } from 'lucide-react';
import apiService from '@/services/api';
import { slugify } from '@/utils/slugify';
import { withProximityFilter } from '@/utils/withProximityFilter';
import { useGeolocationContext } from '@/context/GeolocationContext';
import DistanceBadge from '@/components/shared/DistanceBadge';
import { useSearchRecommendations } from '@/hooks/useSearchRecommendations';
import SearchDropdown from '@/components/shared/SearchDropdown';
import { SourceWatermarkCover, shouldForceSourceWatermark } from '@/components/property/ImageGallery';

function NoticeboardListings(props) {
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
  } = useSearchRecommendations('noticeboard');
  
  // Local state for the component's own data management
  const [filteredNotices, setFilteredNotices] = useState([]);
  const [displayCount, setDisplayCount] = useState(12);
  const [isLocalLoading, setIsLocalLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMoreLocal, setHasMoreLocal] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    noticeType: '',
    datePosted: '',
    location: '',
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });
  const [originalData, setOriginalData] = useState([]);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

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

  // Initial load
  useEffect(() => {
    const runInitialLoad = async () => {
      try {
        await loadNotices(true);
      } catch (loadError) {
        console.error('Noticeboard initial load failed:', loadError);
        setFilteredNotices([]);
        setOriginalData([]);
        setHasMoreLocal(false);
        setError('Failed to load notices. Please try again later.');
      }
    };

    runInitialLoad();
  }, []);

  const loadNotices = async (reset = false) => {
    if (reset) {
      setFilteredNotices([]);
      setDisplayCount(12);
    }

    setIsLocalLoading(true);
    setError(null);

    try {
      // Use API service to get notices
      const response = await apiService.getNotices({
        limit: 50,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        ...(filters.noticeType && { noticeType: filters.noticeType }),
        ...(searchQuery.trim() && { search: searchQuery.trim() })
      });
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to load notices');
      }
      
      let allNotices = (response.data || []).map(notice => ({
        ...notice,
        slug: notice.slug || slugify(`${notice.title}-${notice.id}`)
      }));
      
      // Apply date posted filter
      if (filters.datePosted) {
        const now = new Date();
        let filterDate = new Date();
        
        switch(filters.datePosted) {
          case 'today':
            filterDate.setHours(0, 0, 0, 0);
            break;
          case 'week':
            filterDate.setDate(now.getDate() - 7);
            break;
          case 'month':
            filterDate.setMonth(now.getMonth() - 1);
            break;
          default:
            filterDate = null;
        }
        
        if (filterDate) {
          allNotices = allNotices.filter(notice => {
            const noticeDate = notice.createdAt?.toDate ? 
              notice.createdAt.toDate() : 
              new Date(notice.createdAt);
            return noticeDate >= filterDate;
          });
        }
      }
      
      // Apply location filter
      if (filters.location) {
        const locationLower = filters.location.toLowerCase();
        allNotices = allNotices.filter(notice => 
          notice.location && 
          notice.location.toLowerCase().includes(locationLower)
        );
      }
      
      // Filter out notices without images
      const validNotices = allNotices.filter(
        notice => notice.imageUrls && notice.imageUrls.length > 0
      );
      
      // Store the original filtered results (before pagination)
      setOriginalData(validNotices);
      
      // Apply pagination
      setFilteredNotices(validNotices.slice(0, displayCount));
      
      // Check if there are more notices to load
      setHasMoreLocal(validNotices.length > displayCount);
    } catch (error) {
      console.error('Error loading notices:', error);
      setFilteredNotices([]);
      setOriginalData([]);
      setHasMoreLocal(false);
      setError('Failed to load notices. Please try again later.');
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

  const resetFilters = () => {
    setFilters({
      noticeType: '',
      datePosted: '',
      location: '',
      sortBy: 'createdAt',
      sortOrder: 'desc'
    });
    setSearchQuery('');
    loadNotices(true);
  };

  // Local pagination for when proximity filter is disabled
  const loadMoreLocal = () => {
    if (!isLocalLoading) {
      // Increase display count
      const newDisplayCount = displayCount + 12;
      setDisplayCount(newDisplayCount);
      
      // Update displayed items
      setFilteredNotices(originalData.slice(0, newDisplayCount));
      
      // Check if there are more items to load
      setHasMoreLocal(originalData.length > newDisplayCount);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadNotices(true);
  };

  const applyFilters = () => {
    loadNotices(true);
  };

  const removeFilter = (filterName) => {
    setFilters(prev => ({ ...prev, [filterName]: '' }));
  };

  // Notice type options
  const noticeTypes = [
    { value: '', label: 'All Types' },
    { value: 'announcement', label: 'Announcement' },
    { value: 'event', label: 'Event' },
    { value: 'job', label: 'Job Opportunity' },
    { value: 'lost_found', label: 'Lost & Found' },
    { value: 'community', label: 'Community Notice' },
    { value: 'other', label: 'Other' }
  ];

  // Date posted options
  const datePostedOptions = [
    { value: '', label: 'Any Time' },
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' }
  ];

  // Sort options
  const sortOptions = [
    { value: 'createdAt', label: 'Newest First', order: 'desc' },
    { value: 'createdAt', label: 'Oldest First', order: 'asc' },
    { value: 'title', label: 'Title (A-Z)', order: 'asc' },
    { value: 'title', label: 'Title (Z-A)', order: 'desc' }
  ];

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-white shadow-sm sticky top-14 md:top-16 lg:top-20 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4">
          {/* Title */}
          <h1 className="text-2xl font-bold text-blue-900 mb-4">
            Community Noticeboard
          </h1>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="mb-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
            <div className="relative flex-grow" ref={searchInputRef}>
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <SearchIcon className="text-gray-400" size={20} />
              </div>
              <input
                type="text"
                placeholder="Search notices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={handleSearchFocus}
                className="w-full pl-10 pr-4 py-3 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base sm:text-sm"
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
              className="bg-blue-500 text-white px-4 py-3 sm:py-2 rounded-lg hover:bg-blue-600 transition-colors disabled:bg-blue-300 touch-target min-h-[44px] text-base sm:text-sm font-medium"
            >
              {isLocalLoading ? 'Searching...' : 'Search'}
            </button>
            <button
              type="button"
              onClick={() => setIsFiltersOpen(!isFiltersOpen)}
              className="flex-shrink-0 bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 touch-target min-h-[44px] min-w-[44px] justify-center"
              aria-label={isFiltersOpen ? 'Hide filters' : 'Show filters'}
              aria-expanded={isFiltersOpen}
            >
              <Filter size={20} />
              <span className="hidden sm:inline">Filters</span>
            </button>
          </form>

          {/* Filters Section */}
          <div className={isFiltersOpen ? 'block' : 'hidden'}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Filters</h2>
              <button
                type="button"
                onClick={() => setIsFiltersOpen(false)}
                aria-label="Close filters panel"
                className="inline-flex items-center justify-center rounded-lg p-2 text-blue-600 hover:bg-blue-50 hover:text-blue-700 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid md:grid-cols-4 gap-4 mb-6">
              <select
                name="noticeType"
                value={filters.noticeType}
                onChange={handleFilterChange}
                className="p-2 border rounded-lg"
              >
                {noticeTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>

              <select
                name="datePosted"
                value={filters.datePosted}
                onChange={handleFilterChange}
                className="p-2 border rounded-lg"
              >
                {datePostedOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <input
                type="text"
                name="location"
                placeholder="Filter by location"
                value={filters.location}
                onChange={handleFilterChange}
                className="p-2 border rounded-lg"
              />

              <div className="flex gap-2">
                <button
                  onClick={applyFilters}
                  className="flex-1 p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Apply Filters
                </button>
                <button
                  onClick={resetFilters}
                  className="p-2 text-blue-500 hover:text-blue-600"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* Sorting Options */}
          <div className="flex justify-end mb-6">
            <select
              value={`${filters.sortBy}${filters.sortOrder}`}
              onChange={(e) => {
                const value = e.target.value;
                const sortOption = sortOptions.find(option => option.value + option.order === value);
                
                if (sortOption) {
                  setFilters(prev => ({
                    ...prev,
                    sortBy: sortOption.value,
                    sortOrder: sortOption.order
                  }));
                  
                  loadNotices(true);
                }
              }}
              className="p-2 border rounded-lg bg-gray-50 text-gray-900 border-gray-300"
            >
              {sortOptions.map((option) => (
                <option key={option.value + option.order} value={option.value + option.order}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Active Filters */}
      {(filters.noticeType || filters.datePosted || filters.location || searchQuery) && (
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-gray-600">Active Filters:</span>
            {searchQuery && (
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
                Search: {searchQuery}
                <button 
                  onClick={() => { setSearchQuery(''); loadNotices(true); }} 
                  className="hover:text-blue-600"
                >
                  <X size={14} />
                </button>
              </span>
            )}
            {filters.noticeType && (
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
                Type: {noticeTypes.find(t => t.value === filters.noticeType)?.label}
                <button 
                  onClick={() => { 
                    setFilters(prev => ({ ...prev, noticeType: '' })); 
                    loadNotices(true);
                  }} 
                  className="hover:text-blue-600"
                >
                  <X size={14} />
                </button>
              </span>
            )}
            {filters.datePosted && (
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
                Posted: {datePostedOptions.find(d => d.value === filters.datePosted)?.label}
                <button 
                  onClick={() => {
                    setFilters(prev => ({ ...prev, datePosted: '' }));
                    loadNotices(true);
                  }}
                  className="hover:text-blue-600"
                >
                  <X size={14} />
                </button>
              </span>
            )}
            {filters.location && (
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
                Location: {filters.location}
                <button 
                  onClick={() => {
                    setFilters(prev => ({ ...prev, location: '' }));
                    loadNotices(true);
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

      {/* Notices Grid */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Loading State - use the appropriate loading indicator based on whether proximity is enabled */}
        {(nearbyEnabled ? isProximityLoading : isLocalLoading) ? (
          <div className="grid place-items-center min-h-[50vh]">
            <div className="text-center">
              <Loader2 className="w-16 h-16 animate-spin text-blue-500 mx-auto mb-4" />
              <p className="text-gray-600">
                {nearbyEnabled ? 'Finding notices near you...' : 'Loading notices...'}
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
              <div className="text-center py-12 bg-red-50 rounded-lg">
                <p className="text-red-600 mb-4">{error}</p>
                <button
                  onClick={() => loadNotices(true)}
                  className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                >
                  Try Again
                </button>
              </div>
            ) : (nearbyEnabled ? proximityFilteredData.length === 0 : filteredNotices.length === 0) ? (
              <div className="text-center py-12 bg-gray-100 rounded-lg">
                <p className="text-gray-600 mb-4">
                  {nearbyEnabled 
                    ? 'No notices found near your location' 
                    : 'No notices found matching your criteria'}
                </p>
                <button
                  onClick={resetFilters}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <>
                {/* Add Post Notice button */}
                <div className="mb-6 flex justify-end gap-2">
                  <Link
                    href="/dashboard?tab=my-ads&action=promote&type=noticeboard"
                    className="bg-amber-100 text-amber-800 px-3 py-2 rounded-lg hover:bg-amber-200 transition-colors text-sm inline-flex items-center gap-1"
                  >
                    <Star size={14} />
                    Promote Listing
                  </Link>
                  <Link
                    href="/dashboard?tab=post-ad&type=notice"
                    className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5v14M5 12h14"/>
                    </svg>
                    Post a Notice
                  </Link>
                </div>

                {(() => {
                  const baseNotices = (nearbyEnabled ? proximityFilteredData : filteredNotices) || [];
                  const promotedNotices = baseNotices.filter((notice) => isPromotedActive(notice));
                  if (promotedNotices.length === 0) return null;

                  return (
                    <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                      <div className="flex items-center gap-2 mb-3 text-amber-800 text-sm font-semibold">
                        <Star size={14} />
                        Sponsored Notices
                      </div>
                      <div className="grid md:grid-cols-3 gap-4 [grid-auto-rows:1fr]">
                        {promotedNotices.slice(0, 3).map((notice) => (
                          <Link
                            key={`sponsored-${notice.id}`}
                            href={`/noticeboard/${notice.slug}`}
                            className="bg-white rounded-lg border border-amber-100 p-3 hover:shadow-sm transition-shadow h-full flex flex-col"
                          >
                            <p className="text-sm font-semibold text-blue-900 line-clamp-2 min-h-10">{notice.title}</p>
                            <p className="text-xs text-gray-600 line-clamp-1 mt-1">{notice.location || 'Community'}</p>
                            <p className="text-xs text-blue-800 mt-2 line-clamp-3 min-h-[3.75rem]">{notice.description}</p>
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <div className="grid md:grid-cols-3 gap-6 [grid-auto-rows:1fr]">
                  {/* Map over the appropriate data source based on whether proximity is enabled */}
                  {(nearbyEnabled ? proximityFilteredData : filteredNotices).map((notice) => (
                    <Link 
                      key={notice.id}
                      href={`/noticeboard/${notice.slug}`}
                      className="block group h-full"
                    >
                      <div className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow h-full min-h-[31rem] flex flex-col">
                        <div className="relative">
                          <div className="relative w-full aspect-video">
                            {/* imageUrls is optional on a notice, so index straight
                                into it only after checking -- an image-less notice
                                used to take the whole listing grid down. */}
                            {notice.imageUrls?.[0] ? (
                              <>
                                <Image
                                  src={notice.imageUrls[0]}
                                  alt={notice.title}
                                  fill
                                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                  className="object-cover"
                                  loading="lazy"
                                  unoptimized
                                />
                                <SourceWatermarkCover
                                  imageUrl={notice.imageUrls[0]}
                                  force={shouldForceSourceWatermark(notice)}
                                />
                              </>
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-blue-50 text-blue-300">
                                <Megaphone size={40} />
                              </div>
                            )}
                          </div>
                          {notice.noticeType && (
                            <span className="absolute top-2 right-2 bg-blue-500 text-white px-2 py-1 rounded-full text-sm">
                              {noticeTypes.find(t => t.value === notice.noticeType)?.label || notice.noticeType}
                            </span>
                          )}
                          
                          {/* Distance Badge - only show when proximity filter is active */}
                          {nearbyEnabled && (
                            <DistanceBadge 
                              item={notice} 
                              className="absolute bottom-2 right-2"
                            />
                          )}
                        </div>
                        
                        <div className="p-4 flex flex-col flex-1">
                          <h3 className="text-lg font-semibold text-blue-900 mb-2 line-clamp-2 min-h-[3.5rem] group-hover:text-blue-600">
                            {notice.title}
                          </h3>
                          
                          <p className="text-gray-600 mb-3 line-clamp-3 min-h-[4.5rem]">
                            {notice.description}
                          </p>
                          
                          <div className="flex items-center gap-3 text-sm text-gray-600 mt-auto">
                            {notice.location && (
                              <div className="flex items-center">
                                <MapPin size={16} className="mr-1" />
                                <span className="line-clamp-1">{notice.location}</span>
                              </div>
                            )}
                            <div className="flex items-center">
                              <Clock size={16} className="mr-1" />
                              <span>
                                {notice.createdAt?.seconds
                                  ? new Date(notice.createdAt.seconds * 1000).toLocaleDateString()
                                  : notice.createdAt?.toDate
                                    ? notice.createdAt.toDate().toLocaleDateString()
                                    : notice.createdAt
                                      ? new Date(notice.createdAt).toLocaleDateString()
                                      : ''}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>

                {/* Load More Button - use the appropriate function and flag based on whether proximity is enabled */}
                {(nearbyEnabled ? props.hasMore : hasMoreLocal) && (
                  <div className="text-center mt-8">
                    <button
                      onClick={nearbyEnabled ? () => {} : loadMoreLocal}
                      disabled={(nearbyEnabled ? isProximityLoading : isLocalLoading)}
                      className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                    >
                      {(nearbyEnabled ? isProximityLoading : isLocalLoading) ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        'Load More'
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

// Export with HOC
export default withProximityFilter(NoticeboardListings);
