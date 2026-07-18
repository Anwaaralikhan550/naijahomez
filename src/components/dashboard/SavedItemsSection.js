'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, Home, MapPin, Loader2 } from 'lucide-react';

const routeByType = {
  property: 'property',
  marketplace: 'marketplace',
  housemate: 'housemate',
  service: 'tradespeople',
  tradespeople: 'tradespeople',
  notice: 'noticeboard',
  noticeboard: 'noticeboard'
};

function getSavedItemHref(item) {
  const type = routeByType[item?.type] || 'property';
  const identifier = item?.slug || item?.id;

  if (!identifier) {
    return `/${type}`;
  }

  return `/${type}/${encodeURIComponent(identifier)}`;
}

export default function SavedItemsSection() {
  const [savedItems, setSavedItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('savedItems');
      const parsed = raw ? JSON.parse(raw) : [];
      setSavedItems(Array.isArray(parsed) ? parsed : []);
    } catch (error) {
      console.error('Failed to load saved items:', error);
      setSavedItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[320px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
          <p className="text-gray-600">Loading saved items...</p>
        </div>
      </div>
    );
  }

  if (savedItems.length === 0) {
    return (
      <div className="text-center py-14 px-6 bg-gradient-to-br from-rose-50 via-pink-50 to-blue-50 rounded-2xl border border-pink-100">
        <div className="relative w-20 h-20 mx-auto mb-5">
          <Heart className="w-20 h-20 text-rose-400" />
          <Home className="w-7 h-7 text-blue-500 absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-sm" />
        </div>
        <h3 className="text-2xl font-bold text-gray-800 mb-2">You haven&apos;t saved anything yet</h3>
        <p className="text-gray-600 max-w-md mx-auto mb-7">
          Save properties and listings you love so you can quickly find and compare them later.
        </p>
        <Link
          href="/property"
          className="inline-flex items-center px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
        >
          <Home className="w-4 h-4 mr-2" />
          Browse Properties
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {savedItems.map((item, index) => (
        <Link
          key={item.id || item.slug || `${item.title || 'saved-item'}-${index}`}
          href={getSavedItemHref(item)}
          className="block bg-white border rounded-xl p-4 shadow-sm hover:shadow-md hover:border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all"
          aria-label={`Open ${item.title || 'saved listing'}`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="text-lg font-semibold text-gray-800 hover:text-blue-700 transition-colors">{item.title || 'Saved Listing'}</h4>
              <div className="flex items-center text-gray-500 mt-1">
                <MapPin className="w-4 h-4 mr-1" />
                <span>{item.location || 'Location not provided'}</span>
              </div>
            </div>
            <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
          </div>
        </Link>
      ))}
    </div>
  );
}
