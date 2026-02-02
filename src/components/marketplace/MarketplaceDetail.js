import React, { useState, useEffect } from 'react';
import apiService from '@/services/api';
import { ImageGallery } from '@/components/property/ImageGallery';
import { MapPin, Tag, Clock, AlertTriangle, Heart, Share2, Package, Truck, CreditCard, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import ContactAgent from '@/components/shared/ContactAgent';

// Marketplace subcategories
const MARKETPLACE_SUBCATEGORIES = {
  'computers-laptops': 'Computers & Laptops',
  'mobile-phones': 'Mobile Phones',
  'tablets': 'Tablets',
  'accessories-supplies': 'Accessories & Supplies',
  'furniture': 'Furniture'
};

// Payment type mapping
const PAYMENT_TYPES = {
  'cash': 'Cash Only',
  'bank_transfer': 'Bank Transfer Only',
  'cash_and_transfer': 'Cash and Bank Transfer'
};

// Payment condition mapping
const PAYMENT_CONDITIONS = {
  'before_collection': 'Payment Before Collection/Delivery',
  'on_delivery': 'Payment on Delivery'
};

// Collection type mapping
const COLLECTION_TYPES = {
  'pickup': 'Pick Up Only',
  'delivery': 'Delivery Only',
  'pickup_and_delivery': 'Pick Up and Delivery'
};

// Packaging options mapping
const PACKAGING_OPTIONS = {
  'original_box': 'Original Box',
  'new_packaging': 'New Packaging',
  'own_packaging': 'Own Packaging',
  'no_packaging': 'No Packaging'
};

export default function MarketplaceDetail({ params }) {
  // Use React.use() to unwrap params
  const resolvedParams = React.use(params);
  
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSaved, setIsSaved] = useState(false);
  const [similarItems, setSimilarItems] = useState([]);

  useEffect(() => {
    const loadItemData = async () => {
      try {
        // Get item by slug via API
        const response = await fetch(`/api/marketplace/slug/${resolvedParams.slug}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Item not found');
          } else {
            setError('Failed to load item');
          }
          return;
        }

        const data = await response.json();
        
        // The API returns data in 'data' field, not 'item'
        const item = data.data || data.item;
        setItem(item);

        // Load similar items from API response or fetch separately
        if (data.similar) {
          setSimilarItems(data.similar);
        } else if (item) {
          loadSimilarItems(item);
        }
      } catch (error) {
        console.error('Error loading item:', error);
        setError('Failed to load item data');
      } finally {
        setLoading(false);
      }
    };

    loadItemData();
  }, [resolvedParams.slug]);

  const loadSimilarItems = async (currentItem) => {
    if (!currentItem?.subCategory) return;

    try {
      const response = await fetch(`/api/marketplace?subCategory=${encodeURIComponent(currentItem.subCategory)}&limit=4`);
      
      if (response.ok) {
        const data = await response.json();
        const items = data.items || [];
        
        // Filter out the current item and limit to 3 items
        setSimilarItems(items.filter(item => item.id !== currentItem.id).slice(0, 3));
      }
    } catch (error) {
      console.error('Error loading similar items:', error);
      // Non-critical - just show no similar items
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: item.title,
          text: `Check out this item: ${item.title}`,
          url: window.location.href
        });
        toast.success('Shared successfully!');
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success('Link copied to clipboard!');
      }
    } catch (error) {
      console.error('Error sharing:', error);
      toast.error('Failed to share');
    }
  };

  const handleSaveItem = () => {
    setIsSaved(!isSaved);
    toast.success(isSaved ? 'Removed from favorites' : 'Added to favorites');
    // In a real implementation, this would save to user's favorites in database
  };

  // Calculate listing age
  const getListingAge = () => {
    if (!item?.createdAt) return null;
    
    const createdDate = item.createdAt.seconds 
      ? new Date(item.createdAt.seconds * 1000) 
      : new Date(item.createdAt);
    
    const now = new Date();
    const diffTime = Math.abs(now - createdDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Listed today";
    if (diffDays === 1) return "Listed yesterday";
    if (diffDays < 7) return `Listed ${diffDays} days ago`;
    if (diffDays < 30) return `Listed ${Math.floor(diffDays / 7)} ${Math.floor(diffDays / 7) === 1 ? 'week' : 'weeks'} ago`;
    
    return `Listed ${Math.floor(diffDays / 30)} ${Math.floor(diffDays / 30) === 1 ? 'month' : 'months'} ago`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse">
            <div className="w-16 h-16 bg-blue-500 rounded-full mb-4 mx-auto"></div>
            <p className="text-gray-600">Loading item details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center bg-red-50 p-8 rounded-xl shadow-lg">
          <div className="bg-red-500 text-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={32} />
          </div>
          <p className="text-red-600 text-2xl mb-4">
            {error || 'Item could not be found'}
          </p>
          <p className="text-red-500 mb-4">
            Please check the item link or try again later.
          </p>
          <Link 
            href="/marketplace" 
            className="text-blue-500 hover:text-blue-600"
          >
            Return to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm text-gray-600">
          <Link href="/marketplace" className="hover:text-blue-500">
            Marketplace
          </Link>
          <span>/</span>
          <Link 
            href={`/marketplace?category=${item.subCategory}`} 
            className="hover:text-blue-500"
          >
            {MARKETPLACE_SUBCATEGORIES[item.subCategory] || item.subCategory}
          </Link>
          <span>/</span>
          <span className="text-gray-900">{item.title}</span>
        </div>

        {/* Item Header */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
          <div className="p-6 bg-blue-50 border-b border-blue-100">
            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-xl md:text-2xl font-bold text-blue-900">
                    {item.title}
                  </h1>
                  {item.condition && (
                    <span className="bg-blue-500 text-white px-2 py-0.5 rounded-full text-sm">
                      {item.condition}
                    </span>
                  )}
                </div>
                <div className="flex items-center text-gray-700 mb-2">
                  <MapPin size={20} className="mr-2 text-blue-500" />
                  <span className="text-base md:text-lg">{item.location}</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  {item.createdAt && (
                    <div className="flex items-center">
                      <Clock size={16} className="mr-1" />
                      <span>{getListingAge()}</span>
                    </div>
                  )}
                  {item.viewCount > 0 && (
                    <div className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                      <span>{item.viewCount} views</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="text-left md:text-right">
                <div className="text-xl md:text-2xl font-bold text-blue-900 mb-2">
                  {item.priceString || (item.price ? `₦${parseInt(item.price).toLocaleString()}` : 'Contact for price')}
                </div>
                <div className="flex flex-wrap gap-2 justify-start md:justify-end">
                  <button 
                    onClick={handleSaveItem}
                    className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm
                      ${isSaved 
                        ? 'bg-red-100 text-red-600' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    <Heart size={16} fill={isSaved ? "currentColor" : "none"} />
                    <span>{isSaved ? 'Saved' : 'Save'}</span>
                  </button>
                  <button 
                    onClick={handleShare}
                    className="flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-600 hover:bg-gray-200"
                  >
                    <Share2 size={16} />
                    <span>Share</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="md:col-span-2 space-y-8">
            {/* Image Gallery */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <ImageGallery images={item.imageUrls} />
            </div>

            {/* Payment and Collection Options */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-blue-900 mb-4 border-b pb-4">
                Payment & Collection Options
              </h2>
              <div className="grid grid-cols-2 gap-6">
                {/* Payment Type */}
                {item.paymentType && (
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <CreditCard className="text-blue-500" size={20} />
                    </div>
                    <div>
                      <span className="block text-sm font-medium text-gray-700">Payment Method</span>
                      <span className="block text-gray-600">
                        {PAYMENT_TYPES[item.paymentType] || 'Contact seller'}
                      </span>
                    </div>
                  </div>
                )}
                
                {/* Payment Condition */}
                {item.paymentCondition && (
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <ShieldCheck className="text-green-500" size={20} />
                    </div>
                    <div>
                      <span className="block text-sm font-medium text-gray-700">Payment Terms</span>
                      <span className="block text-gray-600">
                        {PAYMENT_CONDITIONS[item.paymentCondition] || 'Contact seller'}
                      </span>
                    </div>
                  </div>
                )}
                
                {/* Collection Type */}
                {item.collectionType && (
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      {item.collectionType === 'pickup' ? (
                        <Package className="text-purple-500" size={20} />
                      ) : (
                        <Truck className="text-purple-500" size={20} />
                      )}
                    </div>
                    <div>
                      <span className="block text-sm font-medium text-gray-700">Collection Method</span>
                      <span className="block text-gray-600">
                        {COLLECTION_TYPES[item.collectionType] || 'Contact seller'}
                      </span>
                    </div>
                  </div>
                )}
                
                {/* Packaging */}
                {item.packaging && (
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <Package className="text-orange-500" size={20} />
                    </div>
                    <div>
                      <span className="block text-sm font-medium text-gray-700">Packaging</span>
                      <span className="block text-gray-600">
                        {PACKAGING_OPTIONS[item.packaging] || 'Contact seller'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Item Specifications */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-blue-900 mb-6 border-b pb-4">
                Specifications
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {/* Extract numbered attributes */}
                {Array.from({ length: 6 }).map((_, index) => {
                  const nameKey = `attribute_${index + 1}_name`;
                  const valueKey = `attribute_${index + 1}_value`;
                  if (item[nameKey] && item[valueKey]) {
                    return (
                      <div key={index} className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="font-medium text-gray-700">{item[nameKey]}:</span>
                        <span className="text-gray-600">{item[valueKey]}</span>
                      </div>
                    );
                  }
                  return null;
                })}
                
                {/* Add basic item specs if available */}
                {item.subCategory && (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="font-medium text-gray-700">Category:</span>
                    <span className="text-gray-600">
                      {MARKETPLACE_SUBCATEGORIES[item.subCategory] || item.subCategory}
                    </span>
                  </div>
                )}
                
                {/* Add condition if not already displayed elsewhere */}
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="font-medium text-gray-700">Condition:</span>
                  <span className="text-gray-600">{item.condition || 'Not specified'}</span>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-blue-900 mb-6 border-b pb-4">
                Description
              </h2>
              <div className="prose max-w-none">
                <p className="whitespace-pre-wrap text-gray-700">{item.description}</p>
              </div>
            </div>
          </div>

          {/* Contact Section */}
          <div className="space-y-8">
            <ContactAgent 
              agent={{
                id: item.userId,
                name: item.userName,
                title: item.subCategory ? `${MARKETPLACE_SUBCATEGORIES[item.subCategory] || item.subCategory} Seller` : "Marketplace Seller",
                email: item.userEmail,
                photoURL: item.userPhotoURL,
                type: 'seller' // This indicates it's a marketplace seller
              }}
              // Pass the phone number and creation date directly
              phoneNumber={item.phoneNumber}
              createdAt={item.createdAt}
              // Pass view count if available
              viewCount={item.viewCount}
              // Pass listing information for message context
              listingId={item.id}
              listingType="marketplace"
            />

            {/* Similar Items */}
            {similarItems.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-lg font-semibold text-blue-900 mb-4 border-b pb-4">
                  Similar Items
                </h2>
                <div className="space-y-4">
                  {similarItems.map((similarItem) => (
                    <Link 
                      key={similarItem.id} 
                      href={`/marketplace/${similarItem.slug || similarItem.id}`}
                      className="block group"
                    >
                      <div className="flex items-start gap-3">
                        <img
                          src={similarItem.imageUrls?.[0] || "/api/placeholder/400/300"}
                          alt={similarItem.title}
                          className="w-20 h-16 md:w-24 md:h-20 object-cover rounded-lg shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base font-semibold text-blue-900 group-hover:text-blue-700 truncate">
                            {similarItem.title}
                          </h3>
                          <div className="text-lg font-bold text-blue-900 mt-1">
                            {similarItem.priceString || (similarItem.price ? `₦${parseInt(similarItem.price).toLocaleString()}` : 'Contact for price')}
                          </div>
                          <div className="flex items-center gap-1 text-sm mt-1">
                            <Tag size={14} className="text-gray-500" />
                            <span className="text-gray-500">{similarItem.condition}</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Safety Tips */}
            <div className="bg-yellow-50 rounded-xl p-6">
              <h3 className="font-semibold text-yellow-800 mb-3">Safety Tips</h3>
              <ul className="text-sm text-yellow-700 space-y-2">
                <li>• Meet in a safe public place</li>
                <li>• Check the item before paying</li>
                <li>• Never send money in advance</li>
                <li>• Report suspicious behavior</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}