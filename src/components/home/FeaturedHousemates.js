'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { MapPin, Star, Loader2, Home, Bath } from 'lucide-react';
import apiService from '@/services/api';
import { slugify } from '@/utils/slugify';

const FeaturedHousemates = () => {
  const [housemates, setHousemates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadFeaturedHousemates = async () => {
      try {
        setLoading(true);
        
        // Use API service to get recent housemate listings
        const response = await apiService.getHousemates({ 
          limit: 4, 
          sortBy: 'createdAt', 
          sortOrder: 'desc' 
        });
        
        if (response.success) {
          const listings = response.data || [];
          
          // Ensure each listing has a slug
          const processedListings = listings.map(listing => ({
            ...listing,
            slug: listing.slug || slugify(`${listing.title}-${listing.id}`)
          }));
          
          // Filter for valid listings (with images)
          const validListings = processedListings.filter(
            listing => listing.imageUrls && listing.imageUrls.length > 0
          );
        
          // Process each listing for additional features
          const finalListings = validListings.map(listing => {
          // Detect room type
          let roomType = listing.roomType;
          if (!roomType) {
            const title = listing.title?.toLowerCase() || '';
            if (title.includes('self contain')) roomType = 'Self Contained';
            else if (title.includes('shared')) roomType = 'Shared Room';
            else if (title.includes('private')) roomType = 'Private Room';
            else if (title.includes('studio')) roomType = 'Studio';
            else if (title.includes('ensuite')) roomType = 'En-suite';
            else roomType = 'Room';
          }
          
          // Extract features
          const features = [];
          if (listing.bathrooms) features.push('Private Bathroom');
          if (listing.toilets) features.push('Toilet');
          
          if (listing.originalDescription) {
            const desc = listing.originalDescription.toLowerCase();
            if (desc.includes('wifi')) features.push('WiFi');
            if (desc.includes('ac') || desc.includes('air condition')) features.push('AC');
            if (desc.includes('kitchen')) features.push('Kitchen');
            if (desc.includes('furnished')) features.push('Furnished');
          }
          
          return {
            ...listing,
            roomType,
            features: features.slice(0, 2) // Limit to 2 features
          };
          });
          
          setHousemates(finalListings);
        } else {
          throw new Error(response.error || 'Failed to load housemates');
        }
      } catch (error) {
        console.error('Error loading featured housemates:', error);
        setError('Failed to load featured housemate listings');
      } finally {
        setLoading(false);
      }
    };

    loadFeaturedHousemates();
  }, []);

  if (loading) {
    return (
      <div className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-blue-900 mb-12">
            Find a Place to Live
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
            Find a Place to Live
          </h2>
          <div className="text-center py-12 bg-red-50 rounded-lg">
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (housemates.length === 0) {
    return null; // Don't show the section if there are no listings
  }

  return (
    <div className="py-16 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between items-center mb-12">
          <h2 className="text-3xl font-bold text-blue-900">
            Find a Place to Live
          </h2>
          <Link 
            href="/housemate" 
            className="text-orange-500 hover:text-orange-600 transition-colors flex items-center gap-2"
          >
            View All Rooms
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>
        </div>

        <div className="grid md:grid-cols-4 gap-6">
          {housemates.map((listing) => (
            <Link 
              key={listing.id}
              href={`/housemate/${listing.slug}`}
              className="block group"
            >
              <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow">
                <div className="relative">
                  <img
                    src={listing.imageUrls?.[0] || '/api/placeholder/400/300'}
                    alt={listing.title}
                    className="w-full h-48 object-cover"
                    loading="lazy"
                  />
                  <span className="absolute top-2 right-2 bg-blue-500 text-white px-2 py-1 rounded-full text-sm">
                    {listing.roomType}
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-blue-900 mb-2 group-hover:text-blue-700 line-clamp-1">
                    {listing.title}
                  </h3>
                  <div className="flex items-center text-gray-600 mb-3 text-sm">
                    <MapPin size={16} className="mr-1" />
                    <span className="line-clamp-1">{listing.location}</span>
                  </div>
                  <div className="text-xl font-bold text-blue-900 mb-3">
                    {listing.rate}
                  </div>
                  
                  {/* Features */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    {listing.features.map((feature, idx) => (
                      <span key={idx} className="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full">
                        {feature}
                      </span>
                    ))}
                  </div>
                  
                  {/* Bathroom count if available */}
                  {(listing.bathrooms || listing.toilets) && (
                    <div className="flex items-center text-gray-600 text-sm mt-2">
                      <Bath size={16} className="mr-1" />
                      <span>
                        {listing.bathrooms || listing.toilets} 
                        {(listing.bathrooms || listing.toilets) > 1 ? ' bathrooms' : ' bathroom'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FeaturedHousemates;