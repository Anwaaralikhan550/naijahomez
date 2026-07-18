'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { MapPin, Star, Loader2 } from 'lucide-react';
import apiService from '@/services/api';
import { getCleanListingImageUrl } from '@/utils/imageUtils';

const FeaturedTradespeople = () => {
  const [tradespeople, setTradespeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadFeaturedTradespeople = async () => {
      try {
        setLoading(true);
        const result = await apiService.getFeaturedTradespeople(4);
        
        // Filter out services without images
        const validServices = result.filter(
          service => service.imageUrls && service.imageUrls.length > 0
        );
        
        setTradespeople(validServices);
      } catch (error) {
        console.error('Error loading featured tradespeople:', error);
        setError('Failed to load featured tradespeople');
      } finally {
        setLoading(false);
      }
    };

    loadFeaturedTradespeople();
  }, []);

  if (loading) {
    return (
      <div className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-blue-900 mb-12">
            Top Rated Tradespeople
          </h2>
          <div className="grid md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((_, index) => (
              <div key={index} className="animate-pulse">
                <div className="bg-gray-200 h-48 rounded-t-xl"></div>
                <div className="bg-white p-4 rounded-b-xl">
                  <div className="h-4 bg-gray-200 mb-3 w-3/4"></div>
                  <div className="h-4 bg-gray-200 mb-3 w-1/2"></div>
                  <div className="h-4 bg-gray-200 w-1/4"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-blue-900 mb-12">
            Top Rated Tradespeople
          </h2>
          <div className="text-center py-12 bg-red-50 rounded-lg">
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (tradespeople.length === 0) {
    return null;
  }

  return (
    <div className="py-16 bg-gray-50">
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

        <div className="grid md:grid-cols-4 gap-6">
          {tradespeople.map((service) => (
            <Link 
              key={service.id}
              href={`/tradespeople/${service.slug}`}
              className="block group h-full"
            >
              <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow h-full flex flex-col">
                <div className="relative">
                  <img
                    src={getCleanListingImageUrl(service.imageUrls)}
                    alt={service.title}
                    className="w-full h-48 object-cover"
                    loading="lazy"
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
                  <div className="flex items-center gap-2 mb-3">
                    <Star size={16} className="text-orange-500" />
                    <span className="font-medium">{service.rating}</span>
                    <span className="text-gray-500">({service.reviewCount} reviews)</span>
                  </div>
                  <div className="flex items-center justify-between mt-auto">
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
      </div>
    </div>
  );
};

export default FeaturedTradespeople;
