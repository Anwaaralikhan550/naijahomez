'use client';
import React from 'react';
import Link from 'next/link';
import { MapPin, Clock, Package, Truck, CreditCard } from 'lucide-react';
import DistanceBadge from '@/components/shared/DistanceBadge';

// Component for displaying a marketplace item card with the new fields
export default function MarketplaceListingCard({ item, showDistance = false }) {
  const getPaymentTypeText = (paymentType) => {
    switch(paymentType) {
      case 'cash': return 'Cash Only';
      case 'bank_transfer': return 'Bank Transfer Only';
      case 'cash_and_transfer': return 'Cash & Transfer';
      default: return 'Contact Seller';
    }
  };

  const getCollectionTypeIcon = (collectionType) => {
    switch(collectionType) {
      case 'pickup': return <Package size={16} className="mr-1 text-blue-500" />;
      case 'delivery': return <Truck size={16} className="mr-1 text-green-500" />;
      case 'pickup_and_delivery': return <Truck size={16} className="mr-1 text-purple-500" />;
      default: return <Package size={16} className="mr-1 text-gray-500" />;
    }
  };

  const getCollectionTypeText = (collectionType) => {
    switch(collectionType) {
      case 'pickup': return 'Pickup Only';
      case 'delivery': return 'Delivery Only';
      case 'pickup_and_delivery': return 'Pickup & Delivery';
      default: return 'Contact Seller';
    }
  };

  // Format listing date
  const formatListingDate = (timestamp) => {
    if (!timestamp) return '';

    const date = timestamp.seconds
      ? new Date(timestamp.seconds * 1000)
      : new Date(timestamp);

    return date.toLocaleDateString();
  };

  return (
    <Link 
      href={`/marketplace/${item.slug || item.id}`}
      className="block group"
    >
      <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-all transform group-hover:-translate-y-1">
        {/* Image and Condition badge */}
        <div className="relative">
          <img
            src={item.imageUrls?.[0] || '/api/placeholder/400/300'}
            alt={item.title}
            className="w-full h-48 object-cover"
            loading="lazy"
          />
          <span className="absolute top-2 right-2 bg-blue-500 text-white px-2 py-1 rounded-full text-sm">
            {item.condition}
          </span>
          
          {/* Distance Badge - Only show if proximity filtering is active and distance data available */}
          {showDistance && item.distance !== undefined && (
            <DistanceBadge 
              item={item} 
              className="absolute bottom-2 right-2"
            />
          )}
        </div>
        
        {/* Content */}
        <div className="p-4">
          <h3 className="text-lg font-semibold text-blue-900 mb-2 line-clamp-1 group-hover:text-blue-600">
            {item.title}
          </h3>
          
          {/* Price */}
          <div className="text-xl font-bold text-blue-900 mb-3">
            {item.priceString || (item.price ? `₦${item.price.toLocaleString()}` : 'Contact for price')}
          </div>
          
          {/* Payment and Collection Types */}
          <div className="flex flex-wrap text-xs text-gray-600 mb-3 gap-1.5">
            {item.paymentType && (
              <span className="bg-gray-100 px-2 py-1 rounded-full flex items-center">
                <CreditCard size={12} className="mr-1" />
                {getPaymentTypeText(item.paymentType)}
              </span>
            )}
            
            {item.collectionType && (
              <span className="bg-gray-100 px-2 py-1 rounded-full flex items-center">
                {getCollectionTypeIcon(item.collectionType)}
                {getCollectionTypeText(item.collectionType)}
              </span>
            )}
          </div>
          
          {/* Location and Date */}
          <div className="flex items-center justify-between text-sm text-gray-600">
            {item.location && (
              <div className="flex items-center">
                <MapPin size={14} className="mr-1" />
                <span className="truncate max-w-[120px]">{item.location}</span>
              </div>
            )}
            
            {item.createdAt && (
              <div className="flex items-center">
                <Clock size={14} className="mr-1" />
                <span>{formatListingDate(item.createdAt)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}