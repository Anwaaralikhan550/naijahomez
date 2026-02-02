// components/property/SimilarProperties.js
import Link from 'next/link';
import { MapPin, Home } from 'lucide-react';

export default function SimilarProperties({ properties }) {
  // Get unique location text for display
  const getLocationText = (location) => {
    if (!location) return "Unknown location";
    
    // Try to extract the neighborhood/area from the full address
    if (location.includes(',')) {
      const parts = location.split(',').map(p => p.trim());
      // Usually the area/neighborhood is the second-to-last part
      if (parts.length >= 2) {
        return parts[parts.length - 2];
      }
    }
    
    return location;
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 md:p-6">
      <h2 className="text-lg md:text-xl font-semibold text-blue-900 mb-6 border-b pb-4">
        Similar Properties in this Area
      </h2>
      <div className="space-y-4">
        {properties.map((property) => (
          <Link 
            key={property.id} 
            href={`/property/${property.slug}`}
            className="block group"
          >
            <div className="flex items-start gap-3">
              <img
                src={property.imageUrls?.[0] || '/api/placeholder/400/300'}
                alt={property.title}
                className="w-20 h-16 md:w-24 md:h-20 object-cover rounded-lg shrink-0"
              />
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-blue-900 group-hover:text-blue-700 truncate">
                  {property.title}
                </h3>
                <div className="flex items-center text-gray-600 text-sm mt-1">
                  <MapPin size={14} className="shrink-0 mr-1 text-blue-500" />
                  <span className="truncate">{getLocationText(property.location)}</span>
                </div>
                <div className="text-lg font-bold text-blue-900 mt-1">
                  {property.rate}
                </div>
                {/* Display property type and beds/baths if available */}
                <div className="flex items-center gap-3 text-gray-600 text-xs mt-1">
                  <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    {property.type}
                  </span>
                  {property.bedrooms && (
                    <span className="flex items-center">
                      <Home size={12} className="mr-1" />
                      {property.bedrooms} bd{property.bedrooms !== 1 ? 's' : ''}
                      {property.bathrooms && ` | ${property.bathrooms} ba${property.bathrooms !== 1 ? 's' : ''}`}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}