// components/property/PropertyCard.js
import React from 'react';
import Link from 'next/link';
import { MapPin, Bed, Bath } from 'lucide-react';

// Helper function to determine if a property is for sale (when listingType field is missing)
function isForSale(property) {
  if (!property || !property.price) return false;
  
  const priceString = String(property.price);
  
  // Rent typically includes "per month", "/month", "per year", "/year", etc.
  const rentKeywords = ['/month', '/year', 'per month', 'per year', 'per annum', '/annum'];
  
  // Check if any rent keywords exist in the price string
  return !rentKeywords.some(keyword => priceString.toLowerCase().includes(keyword));
}

// Add just before the PropertyCard function definition
function formatPrice(value) {
  if (!value) return '0';
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function extractPriceValue(property) {
  const propertyPrice = 
    (typeof property.price === 'number' ? property.price : null) ||
    (property.saleDetails?.price) ||
    (property.priceNumeric) ||
    (property.rate && typeof property.rate === 'string' 
      ? parseFloat(property.rate.replace(/[^0-9.]/g, '')) 
      : null) ||
    (typeof property.price === 'string' 
      ? parseFloat(property.price.replace(/[^0-9.]/g, ''))
      : 0);
  
  return !isNaN(propertyPrice) ? propertyPrice : 0;
}

export default function PropertyCard({ property, showDistance = false }) {
  if (!property) return null;
  
  // Determine if property is for rent or sale
  const forSale = property.listingType === 'sale' || (!property.listingType && isForSale(property));
  
  return (
    <Link 
      href={`/property/${property.slug}`}
      className="group block"
    >
      <div className="bg-white rounded-xl shadow-lg overflow-hidden transform transition-all hover:-translate-y-2 hover:shadow-xl">
        <div className="relative">
          {/* Property Image */}
          <img
            src={property.imageUrls?.[0] || '/api/placeholder/400/300'}
            alt={property.title || 'Property'}
            className="w-full h-56 object-cover"
            loading="lazy"
          />
          
          {/* Tags - listing type and property type */}
          <div className="absolute top-4 right-4 flex flex-col gap-2">
            <span className={`
              px-3 py-1 rounded-full text-sm font-medium
              ${forSale ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'}
            `}>
              {forSale ? 'For Sale' : 'For Rent'}
            </span>
            
            <span className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-sm">
              {property.propertyType || property.type || 'Property'}
            </span>
          </div>
          
          {/* Distance Badge (if enabled) */}
          {showDistance && property.distance !== undefined && (
            <div className={`
              absolute bottom-2 right-2 px-2 py-1 rounded-full text-xs font-medium
              ${property.distance <= 5 ? 'bg-blue-500 text-white' : 'bg-purple-500 text-white'}
            `}>
              <MapPin size={10} className="inline mr-1" />
              {property.distance === 0 ? 'In this area' : `${property.distance.toFixed(1)}km away`}
            </div>
          )}
        </div>
        
        <div className="p-6">
          {/* Property Title */}
          <h3 className="text-xl font-bold text-blue-900 mb-2 group-hover:text-blue-700 transition-colors line-clamp-2">
            {property.title}
          </h3>
          
          {/* Location */}
          <div className="flex items-center text-gray-600 mb-4">
            <MapPin size={18} className="mr-2 text-blue-500" />
            <span className="line-clamp-1">{property.location}</span>
          </div>
          
          {/* Price and Features */}
          <div className="flex justify-between items-center">
            <div className="text-2xl font-bold text-blue-900">
              {property.listingType === 'sale' || (!property.listingType && isForSale(property))
                ? `₦${formatPrice(property.saleDetails?.price || extractPriceValue(property))}`
                : property.rate || property.price}
              
              {(property.listingType === 'sale' || (!property.listingType && isForSale(property))) && 
              property.saleDetails?.negotiable && (
                <span className="text-sm font-normal bg-green-100 text-green-800 px-2 py-1 rounded ml-2">
                  Negotiable
                </span>
              )}
            </div>
            <div className="flex space-x-3">
              {property.bedrooms && (
                <div className="flex items-center text-gray-600">
                  <Bed size={18} className="mr-1 text-blue-500" />
                  <span>{property.bedrooms}</span>
                </div>
              )}
              {property.bathrooms && (
                <div className="flex items-center text-gray-600">
                  <Bath size={18} className="mr-1 text-blue-500" />
                  <span>{property.bathrooms}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}