'use client';
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Home, Bath, Car, DollarSign, Edit, Trash2, EyeIcon, Eye } from 'lucide-react';
import ListingQrCode from '@/components/shared/ListingQrCode';
import ListingWhatsAppButton from '@/components/shared/ListingWhatsAppButton';

export default function PropertyListingCard({ property, onDelete }) {
    if (!property) return null;
  const safePropertySegment = (() => {
    const rawSlug = property.slug;
    const rawId = property.id;
    const slug = (typeof rawSlug === 'string' || typeof rawSlug === 'number') ? String(rawSlug).trim() : '';
    const id = (typeof rawId === 'string' || typeof rawId === 'number') ? String(rawId).trim() : '';
    return encodeURIComponent(slug || id);
  })();
  // Check if it's an enhanced property with new fields
  const isEnhancedProperty = property.address || 
                            property.rentAmount || 
                            property.fees || 
                            property.contact || 
                            property.amenities;

                            // Safely access potentially undefined properties
  const imageUrls = property.imageUrls || [];
  const title = property.title || 'Untitled Property';
  const location = property.location || 'Location not specified';
  const price = property.price || 'Price not available';
  const propertyType = property.propertyType || property.type || '';
  const bedrooms = property.bedrooms || null;
  const bathrooms = property.bathrooms || null;
  const contactPhone = property.contact?.phone || property.phoneNumber || property.whatsappNumber || property.userPhoneNumber;
  const listingPath = safePropertySegment ? `/property/${safePropertySegment}` : '/property';
  // Format price helper
  const formatPrice = (value) => {
    if (!value) return '';
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  // Get readable property type
  const getPropertyTypeLabel = (type) => {
    switch(type) {
      case 'house': return 'House';
      case 'apartment': return 'Apartment';
      case 'land': return 'Land';
      case 'commercial': return 'Commercial';
      default: return type;
    }
  };

  // Get amenities summary (first 3)
  const getAmenitiesSummary = () => {
    if (!property.amenities || property.amenities.length === 0) {
      return null;
    }

    const amenityLabels = {
      'estate_water': 'Estate Water',
      'estate_electricity': 'Estate/Private Electricity',
      'broadband_wifi': 'Broadband/Wi-Fi',
      'kitchen_appliances': 'Kitchen Appliances',
      'water_heater': 'Water Heater',
      'air_extractor': 'Air Extractor',
      'estate_security': 'Gated with Private Estate Security'
    };

    const displayAmenities = property.amenities.slice(0, 3).map(a => amenityLabels[a] || a);
    const extraCount = Math.max(0, property.amenities.length - 3);
    
    return (
      <div className="text-gray-600 mt-1">
        <span className="font-medium">Amenities:</span> {displayAmenities.join(', ')}
        {extraCount > 0 && ` +${extraCount} more`}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      <div className="md:flex">
        {/* Property Image */}
        <div className="md:w-1/3 relative min-h-[12rem]">
          <Image
            src={property.imageUrls?.[0] || '/api/placeholder/400/300'}
            alt={property.title || 'Property'}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover"
            loading="lazy"
            unoptimized
          />
          <div className="absolute top-2 right-2 bg-blue-600 text-white px-2 py-1 rounded-full text-xs">
            {getPropertyTypeLabel(property.propertyType)}
          </div>
        </div>
        
        {/* Property Details */}
        <div className="p-6 md:w-2/3">
          <div className="flex justify-between">
            <div className="min-w-0">
              <h3 className="text-xl font-semibold text-blue-900 mb-2 line-clamp-2 min-h-[3.5rem]">
                {property.title}
              </h3>
              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-2">
                <Eye className="w-3.5 h-3.5" />
                <span>{property.viewCount || 0} views</span>
              </div>
            </div>
            
            {/* Price display */}
            <div className="text-lg font-bold text-blue-900">
              {isEnhancedProperty && property.rentAmount ? (
                property.rentType === 'monthly' 
                  ? `₦${formatPrice(property.rentAmount.monthly)}/month` 
                  : `₦${formatPrice(property.rentAmount.annual)}/year`
              ) : (
                property.price
              )}
            </div>
          </div>
          
          {/* Location */}
          <div className="flex items-center text-gray-600 mb-3">
            <MapPin className="w-4 h-4 mr-1" />
            <span className="line-clamp-1">{property.location}</span>
            
            {/* Address (if enhanced) */}
            {isEnhancedProperty && property.address && property.address.town && (
              <span className="ml-1 text-gray-500">
                ({property.address.town})
              </span>
            )}
          </div>
          
          {/* Key Features */}
          <div className="flex flex-wrap gap-4 mb-3">
            {/* Bedrooms */}
            {property.bedrooms && (
              <div className="flex items-center text-gray-600">
                <Home className="w-4 h-4 mr-1" />
                <span>{property.bedrooms} {Number(property.bedrooms) === 1 ? 'Bedroom' : 'Bedrooms'}</span>
              </div>
            )}
            
            {/* Bathrooms */}
            {property.bathrooms && (
              <div className="flex items-center text-gray-600">
                <Bath className="w-4 h-4 mr-1" />
                <span>{property.bathrooms} {Number(property.bathrooms) === 1 ? 'Bathroom' : 'Bathrooms'}</span>
              </div>
            )}
            
            {/* Parking Spaces (if enhanced) */}
            {isEnhancedProperty && property.parking && property.parking.available && property.parking.spaces && (
              <div className="flex items-center text-gray-600">
                <Car className="w-4 h-4 mr-1" />
                <span>{property.parking.spaces} Parking</span>
              </div>
            )}
          </div>
          
          {/* Enhanced Property Details */}
          {isEnhancedProperty && (
            <div className="mt-3 border-t pt-3">
              {/* Fees Summary */}
              {property.fees && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2 text-sm">
                  {property.fees.agency && property.fees.agency.value && (
                    <div className="text-gray-600">
                      <span className="font-medium">Agency:</span> {property.fees.agency.type === 'percentage' 
                        ? `${property.fees.agency.value}%` 
                        : `₦${formatPrice(property.fees.agency.value)}`}
                    </div>
                  )}
                  
                  {property.fees.legal && property.fees.legal.value && (
                    <div className="text-gray-600">
                      <span className="font-medium">Legal:</span> {property.fees.legal.type === 'percentage' 
                        ? `${property.fees.legal.value}%` 
                        : `₦${formatPrice(property.fees.legal.value)}`}
                    </div>
                  )}
                  
                  {property.fees.caution && property.fees.caution.required && (
                    <div className="text-gray-600">
                      <span className="font-medium">Caution:</span> ₦{formatPrice(property.fees.caution.value)}
                    </div>
                  )}
                </div>
              )}
              
              {/* Amenities Summary */}
              {getAmenitiesSummary()}
            </div>
          )}
          
          {/* Timestamp & Actions */}
          <div className="flex justify-between items-center pt-4 mt-2 border-t">
            <div className="text-gray-500 text-sm">
              Posted: {property.createdAt?.seconds
                ? new Date(property.createdAt.seconds * 1000).toLocaleDateString()
                : property.createdAt instanceof Date
                  ? property.createdAt.toLocaleDateString()
                  : property.createdAt
                    ? new Date(property.createdAt).toLocaleDateString()
                    : 'Unknown'}
            </div>
            
            <div className="flex gap-2">
              <Link 
                href={listingPath}
                className="text-blue-600 hover:text-blue-800 p-1 rounded-full hover:bg-blue-50"
                title="View Listing"
              >
                <EyeIcon size={20} />
              </Link>
              
              <Link 
                href={`/dashboard/edit-property/${property.id}`}
                className="text-green-600 hover:text-green-800 p-1 rounded-full hover:bg-green-50"
                title="Edit Listing"
              >
                <Edit size={20} />
              </Link>
              
              <button
                onClick={() => onDelete(property.id, 'properties')}
                className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50"
                title="Delete Listing"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 border-t pt-4 md:grid-cols-[1fr_auto] md:items-center">
            <ListingQrCode
              url={listingPath}
              title={title}
              compact
            />
            <ListingWhatsAppButton
              phone={contactPhone}
              title={title}
              listingId={property.id}
              listingType="properties"
              className="justify-center"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
