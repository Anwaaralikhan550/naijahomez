'use client';
import React from 'react';
import Link from 'next/link';
import { MapPin } from 'lucide-react';

const SearchDropdown = ({ 
  isOpen, 
  recommendations, 
  isLoading, 
  onClose, 
  searchQuery = '', 
  dropdownRef 
}) => {
  if (!isOpen) return null;

  // Get type icon and color
  const getTypeInfo = (type) => {
    switch (type) {
      case 'property':
        return { icon: '🏠', color: 'text-blue-600', bg: 'bg-blue-50' };
      case 'marketplace':
        return { icon: '🛒', color: 'text-green-600', bg: 'bg-green-50' };
      case 'service':
        return { icon: '🔧', color: 'text-orange-600', bg: 'bg-orange-50' };
      case 'housemate':
        return { icon: '🛏️', color: 'text-purple-600', bg: 'bg-purple-50' };
      case 'noticeboard':
        return { icon: '📋', color: 'text-indigo-600', bg: 'bg-indigo-50' };
      default:
        return { icon: '📋', color: 'text-gray-600', bg: 'bg-gray-50' };
    }
  };

  return (
    <div
      ref={dropdownRef}
      className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto"
    >
      {isLoading ? (
        <div className="p-4 text-center">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-gray-600 text-sm">Loading recommendations...</p>
        </div>
      ) : recommendations.length > 0 ? (
        <>
          <div className="p-3 border-b border-gray-100">
            <h4 className="text-sm font-medium text-gray-700">Recommended for you</h4>
          </div>
          <div className="py-2">
            {recommendations.map((item) => {
              const typeInfo = getTypeInfo(item.type);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={onClose}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  {/* Image */}
                  <div className="flex-shrink-0">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-12 h-12 object-cover rounded-lg"
                      loading="lazy"
                    />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-1 rounded-full ${typeInfo.bg} ${typeInfo.color}`}>
                        {typeInfo.icon} {item.type}
                      </span>
                    </div>
                    <h5 className="text-sm font-medium text-gray-900 truncate">
                      {item.title}
                    </h5>
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center text-gray-500 text-xs">
                        <MapPin size={12} className="mr-1" />
                        <span className="truncate">{item.location}</span>
                      </div>
                      <span className="text-sm font-semibold text-blue-600 ml-2">
                        {item.price}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
          
          {/* View All Link */}
          {searchQuery && (
            <div className="border-t border-gray-100 p-3">
              <Link
                href={`/search?q=${encodeURIComponent(searchQuery)}`}
                onClick={onClose}
                className="block text-center text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Search "{searchQuery}" →
              </Link>
            </div>
          )}
        </>
      ) : (
        <div className="p-4 text-center">
          <p className="text-gray-600 text-sm">No recommendations available</p>
          <p className="text-gray-500 text-xs mt-1">Start typing to search...</p>
        </div>
      )}
    </div>
  );
};

export default SearchDropdown;