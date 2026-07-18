import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { authenticatedFetch } from '@/services/api';
import { useSearchParams } from 'next/navigation';
import { Package, MapPin, Clock, Tag, Loader2, PlusCircle, Trash2, Home, Briefcase, Bell, SearchX, FilterX, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import PropertyListingCard from './PropertyListingCard';
import { getCleanListingImageUrl } from '@/utils/imageUtils';

export default function MyAdsSection() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedType, setSelectedType] = useState('all');
  const [adsCache, setAdsCache] = useState({});
  const loggedIntentKeyRef = useRef(null);

  const fetchUserAds = useCallback(async (type = selectedType, forceRefresh = false) => {
    try {
      if (!user) {
        setError('Please log in to view your ads');
        setLoading(false);
        return;
      }

      if (!forceRefresh && Array.isArray(adsCache[type])) {
        setAds(adsCache[type]);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        userId: user.uid,
        type,
        limit: '80'
      });
      // Fetch selected ad type from optimized API endpoint
      const response = await authenticatedFetch(`/api/ads?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch ads');
      }

      const data = await response.json();
      const allAds = data.ads || [];

      // Sort by creation date (newest first)
      const sortedAds = allAds.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setAdsCache((prev) => ({
        ...prev,
        [type]: sortedAds
      }));
      setAds(sortedAds);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching ads:', error);
      setError('Failed to load your ads');
      setLoading(false);
    }
  }, [user, selectedType, adsCache]);

  useEffect(() => {
    if (user) {
      fetchUserAds(selectedType);
    } else {
      setLoading(false);
    }
  }, [fetchUserAds, selectedType, user]);

  useEffect(() => {
    const action = searchParams.get('action');
    if (action !== 'promote' || !user) return;

    const rawType = searchParams.get('type') || '';
    const collectionName = rawType === 'property'
      ? 'properties'
      : rawType === 'housemate'
        ? 'housemates'
        : rawType === 'service'
          ? 'services'
          : rawType;
    const listingId = searchParams.get('id') || '';
    const intentKey = `${collectionName}:${listingId || 'general'}`;
    if (loggedIntentKeyRef.current === intentKey) return;
    loggedIntentKeyRef.current = intentKey;

    authenticatedFetch('/api/monetization/intent', {
      method: 'POST',
      body: JSON.stringify({
        intentType: 'promote_listing',
        collectionName,
        listingId,
        planId: 'zero_fee_promote_interest',
        expectedAmount: 0,
        sourcePage: '/dashboard?tab=my-ads&action=promote'
      })
    }).catch((error) => {
      console.warn('Failed to log monetization intent:', error);
    });
  }, [searchParams, user]);

  const handleDeleteAd = async (adId, collectionName) => {
    if (!confirm('Are you sure you want to delete this ad?')) return;
  
    try {
      // Get the ad data first to access image URLs
      const adToDelete = ads.find(ad => ad.id === adId);
      if (!adToDelete) {
        toast.error('Ad not found');
        return;
      }
  
      // Delete only Nijahomzs-owned S3 images. Scraped/claimed listings can contain
      // external image URLs, and those should never block the agent from deleting
      // their advert from Nijahomzs.
      const ownedImageUrls = (adToDelete.imageUrls || []).filter((url) => {
        const value = String(url || '');
        return value.includes('nijahomzs.s3') || value.includes('amazonaws.com/');
      });

      if (ownedImageUrls.length > 0) {
        const response = await authenticatedFetch('/api/delete-images', {
          method: 'POST',
          body: JSON.stringify({
            imageUrls: ownedImageUrls
          })
        });

        if (!response.ok) {
          console.warn('Image cleanup failed; continuing with listing delete.');
        }
      }
  
      // Delete ad via API
      const deleteResponse = await authenticatedFetch(`/api/ads/${adId}?collection=${collectionName}`, {
        method: 'DELETE'
      });

      if (!deleteResponse.ok) {
        throw new Error('Failed to delete ad');
      }
      
      // Update UI
      setAds(prevAds => prevAds.filter(ad => ad.id !== adId));
      setAdsCache((prev) => {
        const next = {};
        Object.entries(prev).forEach(([key, list]) => {
          next[key] = Array.isArray(list) ? list.filter((ad) => ad.id !== adId) : list;
        });
        return next;
      });
      toast.success('Ad deleted successfully');
    } catch (error) {
      console.error('Error deleting ad:', error);
      toast.error('Failed to delete ad: ' + error.message);
    }
  };

  const getAdTypeIcon = (type) => {
    switch (type) {
      case 'properties':
        return <Home className="w-5 h-5" />;
      case 'marketplace':
        return <Package className="w-5 h-5" />;
      case 'services':
        return <Briefcase className="w-5 h-5" />;
      case 'noticeboard':
        return <Bell className="w-5 h-5" />;
      default:
        return null;
    }
  };

  const filteredAds = ads;

  const formatAdPrice = (value) => {
    if (value === null || value === undefined || value === '') return 'N/A';
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value.toLocaleString();
    }

    if (typeof value === 'string') {
      const cleanedNumeric = value.replace(/[^0-9.]/g, '');
      const numericValue = Number(cleanedNumeric);
      if (cleanedNumeric && Number.isFinite(numericValue)) {
        return value.replace(cleanedNumeric, numericValue.toLocaleString());
      }
      return value;
    }

    return String(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
          <p className="mt-2 text-gray-600">Loading your ads...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-500 mb-4">{error}</div>
        <button 
          onClick={fetchUserAds}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (ads.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <h3 className="text-xl font-semibold text-gray-700 mb-2">No Ads Yet</h3>
        <p className="text-gray-500 mb-6">Start posting your properties, items, or services</p>
        <button
          onClick={() => window.location.href = '/dashboard?tab=post-ad'}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors inline-flex items-center"
        >
          <PlusCircle className="w-5 h-5 mr-2" />
          Post Your First Ad
        </button>
      </div>
    );
  }

  if (filteredAds.length === 0) {
    return (
      <div>
        {/* Filter Tabs */}
        <div className="flex space-x-4 mb-6 border-b overflow-x-auto pb-1">
          {[
            { id: 'all', label: 'All Ads' },
            { id: 'properties', label: 'Properties' },
            { id: 'marketplace', label: 'Marketplace' },
            { id: 'services', label: 'Services' },
            { id: 'noticeboard', label: 'Notices' }
          ].map((type) => (
            <button
              key={type.id}
              onClick={() => setSelectedType(type.id)}
              className={`pb-4 px-4 font-medium border-b-2 transition-colors whitespace-nowrap ${
                selectedType === type.id
                  ? 'border-blue-500 text-blue-500'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        <div className="text-center py-12 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <SearchX className="w-16 h-16 text-blue-400" />
            <FilterX className="w-6 h-6 text-indigo-500 absolute -bottom-1 -right-1 bg-white rounded-full p-1" />
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">No ads found in this category</h3>
          <p className="text-gray-600 mb-6">Try switching filters or post a new ad for better visibility.</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={() => setSelectedType('all')}
              className="px-5 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Clear Filter
            </button>
            <button
              onClick={() => window.location.href = '/dashboard?tab=post-ad'}
              className="px-5 py-2.5 bg-white text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors inline-flex items-center"
            >
              <PlusCircle className="w-4 h-4 mr-2" />
              Post Ad
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Filter Tabs */}
      <div className="flex space-x-4 mb-6 border-b overflow-x-auto pb-1">
        {[
          { id: 'all', label: 'All Ads' },
          { id: 'properties', label: 'Properties' },
          { id: 'marketplace', label: 'Marketplace' },
          { id: 'services', label: 'Services' },
          { id: 'noticeboard', label: 'Notices' }
        ].map((type) => (
          <button
            key={type.id}
            onClick={() => setSelectedType(type.id)}
            className={`pb-4 px-4 font-medium border-b-2 transition-colors whitespace-nowrap ${
              selectedType === type.id
                ? 'border-blue-500 text-blue-500'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {type.label}
          </button>
        ))}
      </div>

      {/* Ads Grid */}
      <div className="grid gap-6">
        {filteredAds.map((ad) => {
          // Use PropertyListingCard for property listings
          if (ad.collectionName === 'properties') {
            return (
              <PropertyListingCard
                key={ad.id}
                property={ad}
                onDelete={handleDeleteAd}
              />
            );
          }
          
          // Use standard card for other ad types
          return (
            <div
              key={ad.id}
              className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className="md:flex">
                {/* Image */}
                <div className="md:w-1/4">
                  <img
                    src={getCleanListingImageUrl(ad.imageUrls)}
                    alt={ad.title}
                    className="w-full h-48 md:h-full object-cover"
                  />
                </div>

                {/* Content */}
                <div className="p-6 md:w-3/4">
                  <div className="flex justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-blue-900 mb-2 line-clamp-1">
                        {ad.title}
                      </h3>
                      <div className="flex items-center text-gray-600 mb-2">
                        <MapPin className="w-4 h-4 mr-1" />
                        <span className="line-clamp-1">{ad.location}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xl font-bold text-blue-900 mb-2">
                        {formatAdPrice(ad.price)}
                      </div>
                      <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-sm">
                        {getAdTypeIcon(ad.collectionName)}
                        <span>{ad.collectionName.slice(0, -1)}</span>
                      </span>
                    </div>
                  </div>

                  <p className="text-gray-600 mb-4 line-clamp-2">{ad.description}</p>

                  <div className="flex justify-between items-center pt-4 border-t">
                    <div className="flex items-center gap-4 text-gray-500 text-sm">
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        <span>
                          Posted {ad.createdAt?.seconds
                            ? new Date(ad.createdAt.seconds * 1000).toLocaleDateString()
                            : ad.createdAt
                              ? new Date(ad.createdAt).toLocaleDateString()
                              : 'Unknown'}
                        </span>
                      </div>
                      <div className="flex items-center font-medium text-blue-700">
                        <Eye className="w-4 h-4 mr-1" />
                        <span>{ad.viewCount || 0} views</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteAd(ad.id, ad.collectionName)}
                      className="text-red-500 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
