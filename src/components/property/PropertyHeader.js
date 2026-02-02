// Updated PropertyHeader.js - Remove static placeholder data
import { MapPin, Heart, Share2, Clock } from 'lucide-react';

export default function PropertyHeader({ 
  title, 
  location, 
  price, 
  type,
  createdAt,
  viewCount,
  onShare,
  onSave,
  isSaved
}) {
  // Calculate date listed
  const getListingAge = () => {
    if (!createdAt) return null;
    
    const createdDate = createdAt.seconds 
      ? new Date(createdAt.seconds * 1000) 
      : new Date(createdAt);
    
    const now = new Date();
    const diffTime = Math.abs(now - createdDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Listed today";
    if (diffDays === 1) return "Listed yesterday";
    if (diffDays < 7) return `Listed ${diffDays} days ago`;
    if (diffDays < 30) return `Listed ${Math.floor(diffDays / 7)} ${Math.floor(diffDays / 7) === 1 ? 'week' : 'weeks'} ago`;
    
    return `Listed ${Math.floor(diffDays / 30)} ${Math.floor(diffDays / 30) === 1 ? 'month' : 'months'} ago`;
  };

  const listedText = getListingAge();

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-4 md:mb-8">
      <div className="p-4 md:p-6 bg-blue-50 border-b border-blue-100">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-xl md:text-2xl font-bold text-blue-900">
                {title}
              </h1>
              <span className="bg-green-100 text-green-600 px-2 py-0.5 rounded-full text-sm font-medium">
                Available
              </span>
            </div>
            <div className="flex items-center text-gray-700 mb-2">
              <MapPin size={20} className="mr-2 text-blue-500 shrink-0" />
              <span className="text-base md:text-lg">{location}</span>
            </div>
            
            {/* Only show these if there's actual data */}
            {(listedText || viewCount) && (
              <div className="flex items-center gap-4 text-sm text-gray-500">
                {listedText && (
                  <div className="flex items-center">
                    <Clock size={16} className="mr-1" />
                    <span>{listedText}</span>
                  </div>
                )}
                
                {viewCount && (
                  <div className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                    <span>{viewCount} views</span>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="text-left md:text-right">
            <div className="text-xl md:text-2xl font-bold text-blue-900 mb-2">
              {price}
            </div>
            <div className="flex flex-wrap gap-2 justify-start md:justify-end">
              <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm">
                {type}
              </span>
              <button 
                onClick={onSave}
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm transition-colors
                  ${isSaved 
                    ? 'bg-red-100 text-red-600' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                <Heart size={16} fill={isSaved ? "currentColor" : "none"} />
                <span>{isSaved ? 'Saved' : 'Save'}</span>
              </button>
              <button 
                onClick={onShare}
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
  );
}