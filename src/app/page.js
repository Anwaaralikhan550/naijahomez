'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Home, ShoppingCart, Wrench, MapPin, Bed, Bath, Bell, Star } from 'lucide-react';
import { useFeaturedProperties, useFeaturedTradespeople } from '@/hooks/useApiCache';
import apiService from '@/services/api';
import WhyChooseSection from '@/components/home/WhyChooseSection';
import FeaturedNotices from '@/components/home/FeaturedNotices';
import FeaturedHousemates from '@/components/home/FeaturedHousemates';
import SponsoredAdSlot from '@/components/advertising/SponsoredAdSlot';
import { trackJourneyStep } from '@/lib/analytics/events';
import { SourceWatermarkCover } from '@/components/property/ImageGallery';

// Placeholder Component for Loading Featured Items
const FeaturedItemPlaceholder = () => (
  <div className="bg-white rounded-lg shadow-md overflow-hidden animate-pulse">
    <div className="w-full h-48 bg-gray-200" />
    <div className="p-4">
      <div className="h-4 bg-gray-200 mb-2 w-3/4" />
      <div className="h-4 bg-gray-200 mb-2 w-1/2" />
      <div className="h-4 bg-gray-200 w-1/3" />
    </div>
  </div>
);

function shouldForceWatermark(item) {
  return Boolean(
    item?.isScraped ||
    item?.isScrapedData ||
    item?.dataSource === 'scraped' ||
    item?.sourceUrl
  );
}

export default function HomePage() {
  // Use caching hooks for all sections
  const { 
    data: propertiesData, 
    loading: propertiesLoading, 
    error: propertiesError 
  } = useFeaturedProperties(8);
  
  const { 
    data: tradespeopleData, 
    loading: tradespeopleLoading, 
    error: tradespeopleError 
  } = useFeaturedTradespeople(4);
  
  const [featuredProperties, setFeaturedProperties] = useState([]);
  const [featuredMarketplace, setFeaturedMarketplace] = useState([]);
  const [featuredTradespeople, setFeaturedTradespeople] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showVideoModal, setShowVideoModal] = useState(false);

  useEffect(() => {
    trackJourneyStep('landing', { source: 'home' });
  }, []);

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

  const sponsoredListings = [
    ...featuredProperties.map((item) => ({ ...item, __listingType: 'property' })),
    ...featuredMarketplace.map((item) => ({ ...item, __listingType: 'marketplace' }))
  ]
    .filter((item) => isPromotedActive(item))
    .slice(0, 4);

  const showMarketplaceSection = isLoading || (!error && featuredMarketplace.length > 0);
  const showTradespeopleSection = isLoading || (!error && featuredTradespeople.length > 0);

  const buildSafeListingHref = (basePath, item) => {
    const rawSlug = item?.slug;
    const rawId = item?.id;
    const safeSlug =
      typeof rawSlug === 'string' || typeof rawSlug === 'number'
        ? String(rawSlug).trim()
        : '';
    const safeId =
      typeof rawId === 'string' || typeof rawId === 'number'
        ? String(rawId).trim()
        : '';
    const segment = safeSlug || safeId;
    if (!segment) return basePath;
    return `${basePath}/${encodeURIComponent(segment)}`;
  };

  // Process properties data when it changes
  useEffect(() => {
    if (propertiesData?.success && propertiesData?.data) {
      const validProperties = propertiesData.data
        .filter(property => property.imageUrls && property.imageUrls.length > 0)
        .slice(0, 4);
      setFeaturedProperties(validProperties);
    }
  }, [propertiesData]);

  // Process tradespeople data when it changes
  useEffect(() => {
    if (tradespeopleData?.success && tradespeopleData?.data) {
      const validTradespeople = tradespeopleData.data
        .filter(service => service.imageUrls && service.imageUrls.length > 0)
        .slice(0, 4);
      setFeaturedTradespeople(validTradespeople);
    } else if (tradespeopleError) {
      console.error('Tradespeople loading error:', tradespeopleError);
    }
  }, [tradespeopleData, tradespeopleError]);

  useEffect(() => {
    let isMounted = true;
    
    const loadMarketplaceData = async () => {
      try {
        // Only load marketplace data (tradespeople now uses hook)
        const marketplaceResult = await apiService.getMarketplaceItems({
          limit: 4,
          sortBy: 'createdAt',
          sortOrder: 'desc'
        });

        // Only update state if component is still mounted
        if (!isMounted) return;

        // Filter and slice marketplace items
        if (marketplaceResult?.success && marketplaceResult?.data) {
          const validMarketplaceItems = marketplaceResult.data
            .filter(item => item.imageUrls && item.imageUrls.length > 0)
            .slice(0, 4);
          setFeaturedMarketplace(validMarketplaceItems);
        }

      } catch (error) {
        console.error('Error loading marketplace data:', error);
        if (isMounted) {
          setError('Failed to load marketplace content');
        }
      }
    };

    loadMarketplaceData();
    
    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, []);

  // Update loading state based on all data sources
  useEffect(() => {
    const allDataLoaded = !propertiesLoading && 
                         !tradespeopleLoading && 
                         featuredMarketplace.length >= 0;
    setIsLoading(!allDataLoaded);
    
    if (propertiesError || tradespeopleError) {
      setError(
        propertiesError?.message || 
        tradespeopleError?.message || 
        'Failed to load featured content'
      );
    }
  }, [propertiesLoading, tradespeopleLoading, featuredMarketplace, propertiesError, tradespeopleError]);

  return (
    <div>
      {/* Hero Section */}
      <div className="relative flex min-h-[600px] items-center justify-center">
        <Image
          src="/mosaic-banner.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-blue-600/40" />
        
        <div className="relative z-10 w-full max-w-6xl mx-auto px-4">
          <h1 className="text-4xl md:text-6xl text-white text-center font-bold mb-2 mt-8 sm:mt-12 md:mt-0" title="Find a Home, Tradespeople, Buy or Sell">
            Need Something?
          </h1>
          <div className="flex justify-center w-full mb-8">
            <h2 className="text-xl md:text-2xl text-orange-500 text-center font-semibold px-4 py-2 bg-black/30 inline-block rounded-lg" title="Your Community's Got You Covered">
              Search | Find | Share | Enjoy
            </h2>
          </div>

          {/* Centered Video Button */}
          <div className="flex justify-center">
            <div className="relative flex flex-col items-center gap-4">
              {/* Video Play Button */}
              <button 
                onClick={() => setShowVideoModal(true)}
                className="group relative w-14 h-14 flex-shrink-0 flex items-center justify-center"
              >
                <div className="absolute w-full h-full bg-orange-500 rounded-full opacity-25 group-hover:opacity-50 animate-ping" />
                <div className="absolute w-full h-full bg-orange-500 rounded-full opacity-50 group-hover:opacity-75 animate-pulse" />
                <div className="relative bg-white rounded-full p-3 shadow-lg transform group-hover:scale-110 transition-transform">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 24 24" 
                    fill="currentColor" 
                    className="w-8 h-8 text-orange-500"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </button>
              
              {/* Animated Handwriting Text */}
              <div className="hidden md:block animate-float">
                <p className="handwritten-text text-2xl">
                  <span className="animate-text-writing inline-block">
                    ✨ Play to learn more! ✨
                  </span>
                </p>
              </div>
            </div>
          </div>
          
          {/* Video Modal */}
          {showVideoModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
              <div className="relative w-full max-w-4xl mx-4">
                <button 
                  onClick={() => setShowVideoModal(false)}
                  className="absolute -top-10 right-0 text-white hover:text-orange-500"
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="h-8 w-8" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <div className="relative pt-[56.25%]">
                  <iframe
                    className="absolute top-0 left-0 w-full h-full"
                    src="https://www.youtube.com/embed/XhuvSqoEf4U?autoplay=1"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                  />
                </div>
              </div>
            </div>
          )}

          {/* Category Boxes */}
          <div className="mt-12 mb-8 sm:mb-12 md:mb-0 flex flex-wrap justify-center gap-4 sm:gap-6 md:grid md:grid-cols-5 md:justify-items-center md:place-items-center">
          {[
              {
                name: 'Property',
                href: '/property',
                icon: Home,
                color: 'text-blue-500',
                bgColor: 'bg-blue-50'
              },
              {
                name: 'Housemate',
                href: '/housemate',
                icon: Bed,
                color: 'text-purple-500',
                bgColor: 'bg-purple-50'
              },
              {
                name: 'Marketplace',
                href: '/marketplace',
                icon: ShoppingCart,
                color: 'text-green-500',
                bgColor: 'bg-green-50'
              },
              {
                name: 'Tradespeople',
                href: '/tradespeople',
                icon: Wrench,
                color: 'text-orange-500',
                bgColor: 'bg-orange-50'
              },
              {
                name: 'Noticeboard',
                href: '/noticeboard',
                icon: Bell,
                color: 'text-purple-500',
                bgColor: 'bg-purple-50'
              }
            ].map((category, index) => (
              <Link 
                key={category.name}
                href={category.href}
                className="group"
              >
                <div className={`
                  ${category.bgColor} 
                  rounded-lg 
                  p-3 sm:p-4
                  text-center 
                  hover:shadow-xl 
                  transition-all 
                  transform 
                  hover:-translate-y-2
                  w-[140px] sm:w-[160px]
                  h-[120px] sm:h-[140px]
                  flex
                  flex-col
                  items-center
                  justify-center
                  flex-shrink-0
                `}>
                  <div className={`
                    mx-auto 
                    mb-2 sm:mb-4
                    w-12 sm:w-14
                    h-12 sm:h-14
                    rounded-full 
                    flex 
                    items-center 
                    justify-center 
                    ${category.color} 
                    bg-white 
                    shadow-md 
                    group-hover:shadow-lg 
                    transition-shadow
                  `}>
                    <category.icon size={24} className="sm:w-7 sm:h-7" />
                  </div>
                  <h3 className="text-sm sm:text-base font-semibold text-gray-800 group-hover:text-blue-700 transition-colors leading-tight px-1 overflow-hidden text-ellipsis whitespace-nowrap w-full">
                    {category.name}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {sponsoredListings.length > 0 && (
        <div className="bg-amber-50 border-y border-amber-200 py-10">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-amber-900 inline-flex items-center gap-2">
                <Star size={20} />
                Sponsored Listings
              </h2>
              <Link
                href="/dashboard?tab=my-ads&action=promote"
                className="text-amber-700 hover:text-amber-800 text-sm font-medium"
              >
                Promote Your Listing
              </Link>
            </div>
            <div className="grid md:grid-cols-4 gap-4">
              {sponsoredListings.map((item) => (
                <Link
                  key={`sponsored-${item.id}`}
                  href={buildSafeListingHref(item.__listingType === 'property' ? '/property' : '/marketplace', item)}
                  className="bg-white border border-amber-100 rounded-lg p-3 hover:shadow-md transition-shadow"
                >
                  <p className="text-sm font-semibold text-blue-900 line-clamp-1">{item.title}</p>
                  <p className="text-xs text-gray-600 line-clamp-1 mt-1">{item.location}</p>
                  <p className="text-sm font-bold text-blue-800 mt-2">{item.rate || item.priceString || item.price || 'View details'}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-8">
        <SponsoredAdSlot slot="home_between_listings" variant="banner" />
      </div>

      {/* Featured Properties Section */}
      <div className="bg-gray-50 py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex justify-between items-center mb-12">
            <h2 className="text-3xl font-bold text-blue-900">
              Featured Properties
            </h2>
            <Link 
              href="/property" 
              className="text-orange-500 hover:text-orange-600 transition-colors flex items-center gap-2"
            >
              View All Properties
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
          </div>

          {isLoading ? (
            <div className="grid md:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((_, index) => (
                <FeaturedItemPlaceholder key={index} />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-12 bg-red-50 rounded-lg">
              <h2 className="text-2xl text-red-600 mb-4">Oops! Something went wrong</h2>
              <p className="text-red-500">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : featuredProperties.length > 0 ? (
            <div className="grid md:grid-cols-4 gap-6 [grid-auto-rows:1fr]">
              {featuredProperties.map((property) => (
                <Link 
                  key={property.id} 
                  href={buildSafeListingHref('/property', property)}
                  className="block group h-full"
                >
                  <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow h-full min-h-[21rem] flex flex-col">
                    <div className="relative w-full aspect-video">
                      <Image
                        src={property.imageUrls[0]}
                        alt={property.title}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                        className="object-cover"
                      />
                      <SourceWatermarkCover
                        imageUrl={property.imageUrls[0]}
                        force={shouldForceWatermark(property)}
                      />
                    </div>
                    
                    <div className="p-4 flex flex-col flex-1">
                      <h3 className="text-lg font-semibold text-blue-900 mb-2 group-hover:text-blue-700 transition-colors line-clamp-2 min-h-[3.5rem]">
                        {property.title}
                      </h3>
                      <div className="flex items-center text-gray-600 mb-3 text-sm min-h-5">
                        <MapPin size={16} className="mr-1" />
                        <span className="line-clamp-1">{property.location}</span>
                      </div>
                      <div className="text-xl font-bold text-blue-900 mb-3 min-h-[3rem] flex items-end">
                        {property.rate}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 mt-auto min-h-10">
                        {property.bedrooms && (
                          <div className="flex items-center text-gray-600">
                            <Bed size={16} className="mr-1" />
                            <span className="text-sm">{property.bedrooms} Beds</span>
                          </div>
                        )}
                        {property.bathrooms && (
                          <div className="flex items-center text-gray-600">
                            <Bath size={16} className="mr-1" />
                            <span className="text-sm">{property.bathrooms} Baths</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-100 rounded-lg">
              <p className="text-gray-600">No featured properties available</p>
            </div>
          )}
        </div>
      </div>

      {/* Featured Marketplace Section */}
      {showMarketplaceSection && (
      <div className="bg-white py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex justify-between items-center mb-12">
            <h2 className="text-3xl font-bold text-blue-900">
              Featured in Marketplace
            </h2>
            <Link 
              href="/marketplace" 
              className="text-orange-500 hover:text-orange-600 transition-colors flex items-center gap-2"
            >
              View All Items
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
          </div>

          {isLoading ? (
            <div className="grid md:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((_, index) => (
                <FeaturedItemPlaceholder key={index} />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-12 bg-red-50 rounded-lg">
              <h2 className="text-2xl text-red-600 mb-4">Oops! Something went wrong</h2>
              <p className="text-red-500">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : featuredMarketplace.length > 0 ? (
            <div className="grid md:grid-cols-4 gap-6 [grid-auto-rows:1fr]">
              {featuredMarketplace.map((item) => (
                <Link 
                  key={item.id}
                  href={buildSafeListingHref('/marketplace', item)}
                  className="block group h-full"
                >
                  <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow h-full min-h-[21rem] flex flex-col">
                    <div className="relative w-full aspect-video rounded-t-xl overflow-hidden">
                      <Image
                        src={item.imageUrls[0]}
                        alt={item.title}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                        className="object-cover rounded-t-xl"
                      />
                      <span className="absolute top-2 right-2 bg-orange-100 text-orange-600 px-2 py-1 rounded-full text-sm">
                        {item.condition}
                      </span>
                    </div>
                    <div className="p-4 flex flex-col flex-1">
                      <h3 className="text-lg font-semibold text-blue-900 mb-2 group-hover:text-blue-700 line-clamp-2 min-h-[3.5rem]">
                        {item.title}
                      </h3>
                      <div className="text-xl font-bold text-blue-900 mb-3 min-h-[3rem] flex items-end">
                        {item.priceString}
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mt-auto min-h-10 max-h-10 overflow-hidden">
                        <div className="flex items-center">
                          <MapPin size={16} className="mr-1" />
                          <span className="line-clamp-1">{item.location}</span>
                        </div>
                        <div className="flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                          </svg>
                          <span className="ml-1">
                            {item.createdAt?.seconds
                              ? new Date(item.createdAt.seconds * 1000).toLocaleDateString()
                              : item.createdAt
                                ? new Date(item.createdAt).toLocaleDateString()
                                : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      )}

      {/* Featured Tradespeople Section */}
      {showTradespeopleSection && (
      <div className="bg-gray-50 py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex justify-between items-center mb-12">
            <h2 className="text-3xl font-bold text-blue-900">
              Top Rated Tradespeople
            </h2>
            <Link 
              href="/tradespeople" 
              className="text-orange-500 hover:text-orange-600 transition-colors flex items-center gap-2"
            >
              View All Tradespeople
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
          </div>

          {isLoading ? (
            <div className="grid md:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((_, index) => (
                <FeaturedItemPlaceholder key={index} />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-12 bg-red-50 rounded-lg">
              <h2 className="text-2xl text-red-600 mb-4">Oops! Something went wrong</h2>
              <p className="text-red-500">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : featuredTradespeople.length > 0 ? (
            <div className="grid md:grid-cols-4 gap-6 [grid-auto-rows:1fr]">
              {featuredTradespeople.map((service) => (
                <Link 
                  key={service.id}
                  href={buildSafeListingHref('/tradespeople', service)}
                  className="block group h-full"
                >
                  <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow h-full min-h-[21rem] flex flex-col">
                    <div className="relative w-full aspect-video">
                      <Image
                        src={service.imageUrls[0]}
                        alt={service.title}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                        className="object-cover"
                      />
                      <span className="absolute top-2 right-2 bg-blue-500 text-white px-2 py-1 rounded-full text-sm">
                        {service.serviceType}
                      </span>
                    </div>
                    <div className="p-4 flex flex-col flex-1">
                      <h3 className="text-lg font-semibold text-blue-900 mb-2 group-hover:text-blue-700 line-clamp-2 min-h-[3.5rem]">
                        {service.title}
                      </h3>
                      <p className="text-gray-600 mb-3 line-clamp-1 min-h-6">{service.provider}</p>
                      <div className="flex items-center gap-2 mb-3 min-h-6">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 text-orange-500"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 1l2.928 6.653 6.572.953-4.8 4.672 1.14 6.622L10 16.25l-5.84 3.65 1.14-6.622-4.8-4.672 6.572-.953L10 1z"
                          />
                        </svg>
                        <span className="font-medium">{service.rating}</span>
                        <span className="text-gray-500">({service.reviewCount} reviews)</span>
                      </div>
                      <div className="flex items-center justify-between mt-auto min-h-7">
                        <div className="text-lg font-bold text-blue-900">
                          {service.priceString}
                        </div>
                        <div className="flex items-center text-gray-600 text-sm">
                          <MapPin size={14} className="mr-1" />
                          <span className="line-clamp-1">{service.location}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      )}
      {/* Featured Notices Section */}
      <FeaturedNotices />
      {/* Featured Housemates Section */}
      <FeaturedHousemates />
      {/* Why Choose Section */}
      <WhyChooseSection />

      {/* Call to Action Section */}
      <div 
        className="bg-blue-600 text-white py-16"
        style={{
          backgroundImage: "linear-gradient(rgba(29, 78, 216, 0.8), rgba(29, 78, 216, 0.8)), url('/mosaic-banner.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6">
            Your Journey Starts with Nijahomzs
          </h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            Whether you're looking to buy, sell, or find services, Nijahomzs connects you with endless possibilities.
          </p>
          <div className="flex justify-center space-x-4">
            <Link 
              href="/post-ad" 
              className="px-8 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-lg font-semibold"
            >
              Post Your Ad
            </Link>
            <Link 
              href="/property" 
              className="px-8 py-3 border-2 border-white text-white rounded-lg hover:bg-white hover:text-blue-600 transition-colors text-lg font-semibold"
            >
              Browse Listings
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
