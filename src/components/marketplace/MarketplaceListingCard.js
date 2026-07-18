'use client';
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Clock, Package, Truck, CreditCard, Star } from 'lucide-react';
import DistanceBadge from '@/components/shared/DistanceBadge';

// Component for displaying a marketplace item card with the new fields
export default function MarketplaceListingCard({ item, showDistance = false }) {
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

  const getPrimaryImageUrl = (entry) => {
    const imageList = Array.isArray(entry?.imageUrls) ? entry.imageUrls : [];
    const firstImage = imageList[0];
    if (typeof firstImage === 'string' && firstImage.trim()) return firstImage.trim();
    return '/api/placeholder/400/300';
  };

  return (
    <Link 
      href={`/marketplace/${item.slug || item.id}`}
      className="block group h-full"
    >
      <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-all transform group-hover:-translate-y-1 h-full min-h-[31rem] flex flex-col">
        {/* Image and Condition badge */}
        <div className="relative rounded-t-xl overflow-hidden">
          <div className="relative w-full aspect-video">
            <Image
              src={getPrimaryImageUrl(item)}
              alt={item.title}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover rounded-t-xl"
              loading="lazy"
              unoptimized
            />
          </div>
          {isPromotedActive(item) && (
            <span className="absolute top-2 left-2 bg-amber-100 text-amber-700 border border-amber-200 px-2 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1">
              <Star size={12} />
              Promoted
            </span>
          )}
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
        <div className="p-4 flex flex-col flex-1">
          <h3 className="text-lg font-semibold text-blue-900 mb-2 line-clamp-2 min-h-[3.5rem] group-hover:text-blue-600">
            {item.title}
          </h3>
          
          {/* Price */}
          <div className="text-xl font-bold text-blue-900 mb-3 min-h-[3rem] flex items-end">
            {item.priceString || (item.price ? `₦${item.price.toLocaleString()}` : 'Contact for price')}
          </div>
          
          {/* Payment and Collection Types */}
          <div className="flex flex-wrap text-xs text-gray-600 mb-3 gap-1.5 min-h-[2rem] max-h-[2rem] overflow-hidden">
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
          <div className="flex items-center justify-between text-sm text-gray-600 mt-auto pt-3 min-h-7">
            {item.location && (
              <div className="flex items-center">
                <MapPin size={14} className="mr-1" />
                <span className="line-clamp-1 max-w-[120px]">{item.location}</span>
              </div>
            )}
            
            {item.createdAt ? (
              <div className="flex items-center">
                <Clock size={14} className="mr-1" />
                <span>{formatListingDate(item.createdAt)}</span>
              </div>
            ) : (
              <div className="invisible flex items-center">
                <Clock size={14} className="mr-1" />
                <span>--/--/----</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
