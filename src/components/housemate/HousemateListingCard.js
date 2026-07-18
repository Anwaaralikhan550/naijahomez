// components/housemate/HousemateListingCard.js
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Users, Calendar, Heart, DollarSign, Home, CheckSquare, Wifi, Bath, Star } from 'lucide-react';

const HousemateListingCard = ({ listing, onSaveToggle, isSaved = false }) => {
  const parseDateValue = (value) => {
    if (!value) return null;
    if (value?.toDate && typeof value.toDate === 'function') return value.toDate();
    if (value?.seconds) return new Date(value.seconds * 1000);
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const isPromotedActive = (entry) => {
    if (!entry?.isPromoted) return false;
    const expiry = parseDateValue(entry?.promotionExpiry);
    if (!expiry) return true;
    return expiry.getTime() > Date.now();
  };

  // Map for display formatting
  const advertTypeMap = {
    'room_for_rent': 'Room for Rent',
    'room_wanted': 'Room Wanted',
    'buddy_up': 'Buddy Up'
  };

  const propertyTypeMap = {
    'house_share': 'Room in House Share',
    'self_contained_room': 'Self-Contained Room',
    'self_contained_flat': 'Self-Contained Flat',
    'whole_property': 'Whole Property',
    // Legacy mappings
    'private': 'Private Room',
    'shared': 'Shared Room',
    'studio': 'Studio',
    'ensuite': 'En-suite Room',
    'self_contained': 'Self Contained'
  };

  // The amenities mapping for display purposes
  const amenitiesMap = {
    'wifi': { label: 'WiFi', icon: Wifi },
    'laundry': { label: 'Laundry', icon: Home },
    'kitchen': { label: 'Kitchen', icon: Home },
    'private_kitchen': { label: 'Private Kitchen', icon: Home },
    'bathroom': { label: 'Private Bathroom', icon: Bath },
    'parking': { label: 'Parking', icon: Home },
    'car_park': { label: 'Car Park', icon: Home },
    'ac': { label: 'Air Conditioning', icon: Home },
    'bills': { label: 'Bills Included', icon: DollarSign },
    'ensuite': { label: 'Ensuite', icon: CheckSquare },
    'furnished': { label: 'Furnished', icon: Home },
    'unfurnished': { label: 'Unfurnished', icon: Home },
    '24hr_light': { label: '24hrs Light', icon: Home },
    'gated_security': { label: 'Gated Security', icon: Home },
    'garden': { label: 'Garden', icon: Home },
    'broadband': { label: 'Broadband', icon: Wifi },
    'water_heater': { label: 'Water Heater', icon: Home }
  };

  // Get the formatted advert and property types
  const advertType = listing.advertType || 'room_for_rent'; 
  const displayAdvertType = advertTypeMap[advertType] || 'Room for Rent';
  
  const propertyType = listing.propertyType || listing.roomType || 'house_share';
  const displayPropertyType = propertyTypeMap[propertyType] || 'Room';

  // Function to format price with commas
  const formatPrice = (value) => {
    if (!value) return '0';
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  // Format price display based on advert type
  const getPriceDisplay = () => {
    if (advertType === 'room_for_rent') {
      return listing.rate || `₦${formatPrice(listing.price)}/month`;
    } else {
      const minPrice = listing.minPrice ? `₦${formatPrice(listing.minPrice)}` : '';
      const maxPrice = listing.maxPrice ? `₦${formatPrice(listing.maxPrice)}` : '';
      
      if (minPrice && maxPrice) {
        return `${minPrice} - ${maxPrice}`;
      } else if (minPrice) {
        return `From ${minPrice}`;
      } else if (maxPrice) {
        return `Up to ${maxPrice}`;
      } else {
        // Fallback for legacy listings
        return listing.rate || `₦${formatPrice(listing.price)}/month`;
      }
    }
  };

  // Get available amenities
  const amenities = listing.amenities || [];
  const displayAmenities = amenities.slice(0, 3);
  
  // Calculate date listed
  const getListingAge = () => {
    if (!listing.createdAt) return "Recently listed";
    
    const createdDate = listing.createdAt.seconds 
      ? new Date(listing.createdAt.seconds * 1000) 
      : new Date(listing.createdAt);
    
    const now = new Date();
    const diffTime = Math.abs(now - createdDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} ${Math.floor(diffDays / 7) === 1 ? 'week' : 'weeks'} ago`;
    
    return `${Math.floor(diffDays / 30)} ${Math.floor(diffDays / 30) === 1 ? 'month' : 'months'} ago`;
  };
  
  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden transform transition-all hover:-translate-y-2 hover:shadow-xl h-full min-h-[34rem] flex flex-col">
      {/* Image Section with Labels */}
      <div className="relative">
        <Link href={`/housemate/${listing.slug}`}>
          <div className="relative w-full aspect-video">
            <Image
              src={listing.imageUrls?.[0] || '/api/placeholder/400/300'}
              alt={listing.title}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover"
              loading="lazy"
              unoptimized
            />
          </div>
        </Link>
        
        {/* Top labels */}
        <div className="absolute top-3 left-3 right-3 flex justify-between">
          <div className="flex items-center gap-2">
            <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">
              {displayAdvertType}
            </span>
            {isPromotedActive(listing) && (
              <span className="bg-amber-100 text-amber-700 border border-amber-200 px-2 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1">
                <Star size={12} />
                Promoted
              </span>
            )}
          </div>
          
          <button 
            onClick={() => onSaveToggle && onSaveToggle(listing.id)}
            className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
              isSaved ? 'bg-red-500 text-white' : 'bg-white/80 text-gray-700 hover:bg-white'
            }`}
          >
            <Heart size={16} fill={isSaved ? "currentColor" : "none"} />
          </button>
        </div>
        
        {/* Bottom label */}
        <div className="absolute bottom-3 left-3">
          <span className="bg-blue-600/80 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm">
            {displayPropertyType}
          </span>
        </div>
      </div>
      
      {/* Content */}
      <Link href={`/housemate/${listing.slug}`} className="block p-4 flex flex-col flex-1">
        {/* Title and Price */}
        <div className="mb-3">
          <h3 className="text-lg font-semibold text-blue-900 mb-1 line-clamp-2 min-h-[3.5rem]">
            {listing.title}
          </h3>
          <div className="flex items-center text-gray-600 mb-2">
            <MapPin size={16} className="mr-1 text-blue-500 flex-shrink-0" />
            <span className="line-clamp-1">{listing.location}</span>
          </div>
          <div className="text-xl font-bold text-blue-900">
            {getPriceDisplay()}
            {listing.billsIncluded && (
              <span className="ml-2 text-xs font-normal text-green-600 bg-green-50 px-2 py-0.5 rounded">
                Bills Included
              </span>
            )}
          </div>
        </div>
        
        {/* Amenities */}
        <div className="flex flex-wrap gap-2 mb-3 min-h-[2.5rem] max-h-[2.5rem] overflow-hidden">
          {displayAmenities.length > 0 ? (
            <>
              {displayAmenities.map((amenity, idx) => {
                const amenityInfo = amenitiesMap[amenity] || { label: amenity, icon: CheckSquare };
                const Icon = amenityInfo.icon;
                
                return (
                  <span key={idx} className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs flex items-center gap-1">
                    <Icon size={12} className="text-blue-500" />
                    {amenityInfo.label}
                  </span>
                );
              })}
              {amenities.length > 3 && (
                <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs">
                  +{amenities.length - 3} more
                </span>
              )}
            </>
          ) : (
            <span className="invisible bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs">
              Placeholder
            </span>
          )}
        </div>
        
        {/* Footer with Date & Availability */}
        <div className="pt-3 border-t border-gray-100 flex justify-between items-center text-sm text-gray-500 mt-auto">
          <div className="flex items-center">
            <Calendar size={14} className="mr-1" />
            <span>{getListingAge()}</span>
          </div>
          
          {listing.moveInDate || listing.availableFrom ? (
            <div className="flex items-center">
              <span className="text-green-600">
                Available {new Date(listing.moveInDate || listing.availableFrom).toLocaleDateString('en-GB', {
                  month: 'short', 
                  day: 'numeric'
                })}
              </span>
            </div>
          ) : (
            <div className="flex items-center">
              <span className="text-green-600">Available Now</span>
            </div>
          )}
        </div>
      </Link>
      <div className="px-4 pb-4 min-h-9 flex items-end">
        {!isPromotedActive(listing) ? (
          <Link
            href={`/dashboard?tab=my-ads&action=promote&type=housemate&id=${encodeURIComponent(listing.id || '')}`}
            className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 hover:bg-amber-100 transition-colors"
          >
            <Star size={12} />
            Promote Listing
          </Link>
        ) : (
          <span className="invisible inline-flex items-center gap-1 text-xs border rounded-full px-3 py-1">
            <Star size={12} />
            Promote Listing
          </span>
        )}
      </div>
    </div>
  );
}

export default HousemateListingCard;
