'use client';
import React, { useState, useEffect } from 'react';
import { 
  Flag, Share2, Heart, AlertTriangle, Loader2, 
  Users, Wifi, Home, MapPin, Calendar, Bath, 
  Coffee, CheckSquare, DollarSign, Clock, CheckCircle
} from 'lucide-react';
// Replaced with API service calls
import apiService from '@/services/api';
import { ImageGallery, shouldForceSourceWatermark } from '@/components/property/ImageGallery';
import ContactAgent from '@/components/shared/ContactAgent';
import ListingReportModal from '@/components/reporting/ListingReportModal';
import toast from 'react-hot-toast';
import Link from 'next/link';
import Image from 'next/image';
import DOMPurify from 'isomorphic-dompurify';

export default function HousemateDetail({ params }) {
  // Unwrap params using React.use()
  const resolvedParams = React.use(params);
  
  const [listing, setListing] = useState(null);
  const [similarListings, setSimilarListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSaved, setIsSaved] = useState(false);
  const [viewCount, setViewCount] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);

  // Maps for display purposes
  const advertTypeMap = {
    'room_for_rent': 'Room for Rent',
    'room_wanted': 'Room Wanted',
    'buddy_up': 'Buddy Up to Find Room'
  };

  const propertyTypeMap = {
    'house_share': 'Room in House Share',
    'self_contained_room': 'Self-Contained Room',
    'self_contained_flat': 'Self-Contained Flat',
    'whole_property': 'Whole Property to Share',
    // Legacy mappings
    'private': 'Private Room',
    'shared': 'Shared Room',
    'studio': 'Studio Apartment',
    'ensuite': 'En-suite Room',
    'self_contained': 'Self Contained'
  };

  const preferredGenderMap = {
    'any': 'No Preference',
    'female': 'Females Only',
    'male': 'Males Only',
    'male_or_female': 'Males or Females',
    'couples': 'Couples'
  };

  const ageRangeMap = {
    'under_30': 'Under 30 years',
    '30_to_40': '30 to 40 years',
    '40_to_50': '40 to 50 years',
    'above_50': 'Above 50 years',
    'any_age': 'Any Age'
  };

  const lengthOfStayMap = {
    '1_to_3_months': '1-3 months',
    '3_to_6_months': '3-6 months',
    '6_to_12_months': '6-12 months',
    'over_12_months': 'Over 12 months',
    'flexible': 'Flexible'
  };

  // The amenities mapping for display purposes
  const amenitiesMap = {
    'wifi': { label: 'WiFi', icon: Wifi },
    'laundry': { label: 'Laundry', icon: Home },
    'kitchen': { label: 'Kitchen', icon: Coffee },
    'private_kitchen': { label: 'Private Kitchen', icon: Coffee },
    'bathroom': { label: 'Private Bathroom', icon: Bath },
    'parking': { label: 'Parking', icon: Home },
    'car_park': { label: 'Car Park', icon: Home },
    'ac': { label: 'Air Conditioning', icon: Home },
    'bills': { label: 'Bills Included', icon: DollarSign },
    'ensuite': { label: 'Ensuite', icon: CheckSquare },
    'furnished': { label: 'Furnished', icon: Home },
    'unfurnished': { label: 'Unfurnished', icon: Home },
    '24hr_light': { label: '24hrs Light', icon: Home },
    'gated_security': { label: 'Gated with Security', icon: Home },
    'garden': { label: 'Garden', icon: Home },
    'broadband': { label: 'Broadband', icon: Wifi },
    'water_heater': { label: 'Water Heater', icon: Home }
  };

  // Extract features from description
  const extractFeatures = (description) => {
    if (!description) return [];
    
    // Try to extract features from HTML format
    if (description.includes('<li>')) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(description, 'text/html');
      const featureElements = doc.querySelectorAll('li');
      
      if (featureElements.length > 0) {
        return Array.from(featureElements).map(el => el.textContent);
      }
    }
    
    // Fallback to text parsing if HTML extraction fails
    const features = [];
    const lines = description.split('\n');
    
    for (const line of lines) {
      if (line.trim().startsWith('- ') || line.trim().startsWith('• ')) {
        features.push(line.trim().substring(2));
      }
    }
    
    return features;
  };

  // Clean HTML content for display
  const cleanHtmlContent = (htmlContent) => {
    if (!htmlContent) return '';
    
    // Remove markdown code blocks if present
    let cleanedContent = htmlContent.replace(/```html|```/g, '');
    
    return cleanedContent;
  };

  useEffect(() => {
    const loadListingData = async () => {
      try {
        const response = await apiService.getHousemateBySlug(resolvedParams.slug);
        
        if (!response || !response.data) {
          setError('Listing not found');
          return;
        }

        const listingData = response.data;

        // Track this view if needed
        if (listingData.viewCount) {
          setViewCount(listingData.viewCount);
        }

        setListing(listingData);
        
        // Use similar listings from API response
        setSimilarListings(response.similar || []);
      } catch (error) {
        console.error('Error loading housemate listing:', error);
        setError('Failed to load listing data');
      } finally {
        setLoading(false);
      }
    };

    loadListingData();
  }, [resolvedParams.slug]);

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: listing.title,
          text: `Check out this housemate listing: ${listing.title}`,
          url: window.location.href
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success('Link copied to clipboard!');
      }
    } catch (error) {
      console.error('Error sharing:', error);
      toast.error('Failed to share');
    }
  };

  const handleSave = () => {
    setIsSaved(!isSaved);
    toast.success(isSaved ? 'Removed from favorites' : 'Added to favorites');
    // Add actual save functionality here if implemented
  };

  // Function to calculate listing age
  const getListingAge = () => {
    if (!listing?.createdAt) return null;
    
    const createdDate = listing.createdAt.seconds 
      ? new Date(listing.createdAt.seconds * 1000) 
      : new Date(listing.createdAt);
    
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
          <Loader2 className="w-16 h-16 animate-spin text-blue-500 mx-auto" />
          <p className="text-gray-600 mt-4">Loading listing details...</p>
        </div>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center bg-red-50 p-8 rounded-xl shadow-lg max-w-lg mx-4">
          <div className="bg-red-500 text-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-red-600 text-2xl font-bold mb-4">
            {error || 'Listing Not Found'}
          </h2>
          <p className="text-red-500 mb-6">
            Please check the listing link or try again later.
          </p>
          <a 
            href="/housemate"
            className="inline-block bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Browse Housemates
          </a>
        </div>
      </div>
    );
  }

  // Prepare description content for display
  const cleanDescription = cleanHtmlContent(listing.description);
  const extractedFeatures = extractFeatures(listing.originalDescription || listing.description);
  
  // Determine property type for display
  const propertyType = listing.propertyType || listing.roomType || '';
  const displayPropertyType = propertyTypeMap[propertyType] || 'Room';

  // Get advert type (defaulting to "Room for Rent" for legacy listings)
  const advertType = listing.advertType || 'room_for_rent';
  const displayAdvertType = advertTypeMap[advertType] || 'Room for Rent';

  // Get all amenities, combining new and legacy formats
  const amenities = listing.amenities || [];
  const normalizedPosterKycStatus = (
    listing?.user?.kycStatus ||
    listing?.kycStatus ||
    ''
  ).toString().toLowerCase();
  const isPosterVerified = Boolean(
    listing?.agentVerified ||
    listing?.userVerified ||
    listing?.isVerified ||
    listing?.verified ||
    normalizedPosterKycStatus === 'verified'
  );

  // Format price display based on advert type
  const getPriceDisplay = () => {
    if (advertType === 'room_for_rent') {
      return listing.rate || `₦${listing.price}/month`;
    } else {
      const minPrice = listing.minPrice ? `₦${listing.minPrice}` : '';
      const maxPrice = listing.maxPrice ? `₦${listing.maxPrice}` : '';
      
      if (minPrice && maxPrice) {
        return `${minPrice} - ${maxPrice}`;
      } else if (minPrice) {
        return `From ${minPrice}`;
      } else if (maxPrice) {
        return `Up to ${maxPrice}`;
      } else {
        // Fallback for legacy listings
        return listing.rate || `₦${listing.price}/month`;
      }
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm text-gray-600">
          <Link href="/housemate" className="hover:text-blue-500">
            Housemates
          </Link>
          <span>/</span>
          <Link 
            href={`/housemate?propertyType=${propertyType}`} 
            className="hover:text-blue-500"
          >
            {displayPropertyType}
          </Link>
          <span>/</span>
          <span className="text-gray-900">{listing.title}</span>
        </div>

        {/* Listing Header */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
          <div className="p-6 bg-blue-50 border-b border-blue-100">
            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-xl md:text-2xl font-bold text-blue-900">
                    {listing.title}
                  </h1>
                  {isPosterVerified && (
                    <span
                      title="Identity verified"
                      className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700"
                    >
                      <CheckCircle size={12} />
                      Verified
                    </span>
                  )}
                  <span className="bg-blue-500 text-white px-2 py-0.5 rounded-full text-sm">
                    {displayAdvertType}
                  </span>
                </div>
                
                <div className="flex items-center text-gray-700 mb-2">
                  <MapPin size={20} className="mr-2 text-blue-500" />
                  <span className="text-base md:text-lg">{listing.location}</span>
                </div>
                
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  {listing.createdAt && (
                    <div className="flex items-center">
                      <Clock size={16} className="mr-1" />
                      <span>{getListingAge()}</span>
                    </div>
                  )}
                  {viewCount > 0 && (
                    <div className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                      <span>{viewCount} views</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="text-left md:text-right">
                <div className="text-xl md:text-2xl font-bold text-blue-900 mb-2">
                  {getPriceDisplay()}
                  {listing.billsIncluded && (
                    <span className="ml-2 text-sm font-normal text-green-600 bg-green-50 px-2 py-0.5 rounded">
                      Bills Included
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 justify-start md:justify-end">
                  <button 
                    onClick={handleSave}
                    className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm transition-colors
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
          {/* First Column - Listing Details */}
          <div className="md:col-span-2 space-y-8">
            <div className="w-full">
              <ImageGallery
                images={listing.imageUrls}
                coverSourceWatermark={shouldForceSourceWatermark(listing)}
              />
            </div>

            {/* Key Details */}
            <div className="w-full bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-semibold text-blue-900 mb-6 border-b pb-4">
                Key Details
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                {/* Property Type */}
                <div className="flex items-center gap-4">
                  <div className="bg-blue-100 text-blue-500 p-3 rounded-full">
                    <Home size={24} />
                  </div>
                  <div>
                    <h3 className="text-gray-500 text-sm">Property Type</h3>
                    <p className="font-semibold text-gray-700">{displayPropertyType}</p>
                  </div>
                </div>

                {/* Availability Date */}
                {(listing.moveInDate || listing.availableFrom) && (
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-100 text-blue-500 p-3 rounded-full">
                      <Calendar size={24} />
                    </div>
                    <div>
                      <h3 className="text-gray-500 text-sm">Available From</h3>
                      <p className="font-semibold text-gray-700">
                        {(() => {
                          const dateValue = listing.moveInDate || listing.availableFrom;
                          if (dateValue?.seconds) {
                            return new Date(dateValue.seconds * 1000).toLocaleDateString();
                          }
                          return dateValue ? new Date(dateValue).toLocaleDateString() : 'Contact for details';
                        })()}
                      </p>
                    </div>
                  </div>
                )}

                {/* Length of Stay */}
                {listing.lengthOfStay && (
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-100 text-blue-500 p-3 rounded-full">
                      <Clock size={24} />
                    </div>
                    <div>
                      <h3 className="text-gray-500 text-sm">Length of Stay</h3>
                      <p className="font-semibold text-gray-700">
                        {lengthOfStayMap[listing.lengthOfStay] || listing.lengthOfStay}
                      </p>
                    </div>
                  </div>
                )}

                {/* Gender Preference */}
                {listing.preferredGender && (
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-100 text-blue-500 p-3 rounded-full">
                      <Users size={24} />
                    </div>
                    <div>
                      <h3 className="text-gray-500 text-sm">Gender Preference</h3>
                      <p className="font-semibold text-gray-700">
                        {preferredGenderMap[listing.preferredGender] || listing.preferredGender}
                      </p>
                    </div>
                  </div>
                )}

                {/* Age Preference */}
                {listing.preferredAge && (
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-100 text-blue-500 p-3 rounded-full">
                      <Users size={24} />
                    </div>
                    <div>
                      <h3 className="text-gray-500 text-sm">Age Preference</h3>
                      <p className="font-semibold text-gray-700">
                        {ageRangeMap[listing.preferredAge] || listing.preferredAge}
                      </p>
                    </div>
                  </div>
                )}

                {/* Interested Areas - if applicable */}
                {listing.interestedAreas && (
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-100 text-blue-500 p-3 rounded-full">
                      <MapPin size={24} />
                    </div>
                    <div>
                      <h3 className="text-gray-500 text-sm">Interested Areas</h3>
                      <p className="font-semibold text-gray-700">{listing.interestedAreas}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Amenities Section */}
            {amenities.length > 0 && (
              <div className="w-full bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-2xl font-semibold text-blue-900 mb-6 border-b pb-4">
                  Amenities
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {amenities.map((amenity, index) => {
                    const amenityDetails = amenitiesMap[amenity] || { label: amenity, icon: CheckSquare };
                    const Icon = amenityDetails.icon;
                    
                    return (
                      <div key={index} className="flex items-start gap-3">
                        <div className="bg-blue-50 text-blue-500 p-2 rounded-full mt-1">
                          <Icon size={16} />
                        </div>
                        <span className="text-gray-700">{amenityDetails.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Features */}
            {extractedFeatures.length > 0 && (
              <div className="w-full bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-2xl font-semibold text-blue-900 mb-6 border-b pb-4">
                  Features
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {extractedFeatures.map((feature, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="bg-blue-50 text-blue-500 p-2 rounded-full mt-1">
                        <CheckSquare size={16} />
                      </div>
                      <span className="text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            <div className="w-full bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-semibold text-blue-900 mb-6 border-b pb-4">
                Description
              </h2>
              {listing.originalDescription ? (
                <div className="text-gray-700 leading-relaxed prose max-w-none whitespace-pre-wrap">
                  {listing.originalDescription}
                </div>
              ) : (
                <div 
                  className="text-gray-700 leading-relaxed prose max-w-none"
                  dangerouslySetInnerHTML={{ 
                    __html: DOMPurify.sanitize(cleanDescription) 
                  }}
                />
              )}
            </div>

            {/* House Rules */}
            {listing.houseRules && (
              <div className="w-full bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-2xl font-semibold text-blue-900 mb-6 border-b pb-4">
                  House Rules
                </h2>
                <div className="text-gray-700 leading-relaxed prose max-w-none whitespace-pre-wrap">
                  {listing.houseRules}
                </div>
              </div>
            )}

            {/* Report Button */}
            <div className="flex justify-end w-full">
              <button 
                onClick={() => setShowReportModal(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
              >
                <Flag size={16} />
                <span>Report this Ad</span>
              </button>
            </div>
          </div>

          {/* Second Column - Contact & Similar Listings */}
          <div className="md:col-span-1 space-y-8">
            <ContactAgent 
              agent={{
                id: listing.userId,
                name: listing.userName || "Listing Owner",
                title: advertType === 'room_for_rent' ? "Room Owner/Manager" : "Room Seeker",
                email: listing.userEmail || listing.email,
                photoURL: listing.userPhotoURL,
                isVerified: Boolean(
                  listing?.agentVerified ??
                  listing?.userVerified ??
                  listing?.isVerified ??
                  listing?.verified
                ),
                kycStatus: listing?.user?.kycStatus || listing?.kycStatus || null,
              }}
              // Pass the phone number and creation date directly
              phoneNumber={listing.phoneNumber}
              createdAt={listing.createdAt}
              // Pass listing information for message context
              listingId={listing.id}
              listingType="housemate"
            />

            {/* Similar Listings */}
            {similarListings.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-lg md:text-xl font-semibold text-blue-900 mb-6 border-b pb-4">
                  Similar Listings in this Area
                </h2>
                <div className="space-y-4">
                  {similarListings.map((similarListing) => (
                    <Link 
                      key={similarListing.id} 
                      href={`/housemate/${similarListing.slug}`}
                      className="block group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative w-20 h-16 md:w-24 md:h-20 rounded-lg shrink-0 overflow-hidden">
                          <Image
                            src={similarListing.imageUrls?.[0] || "/api/placeholder/400/300"}
                            alt={similarListing.title}
                            fill
                            sizes="(max-width: 768px) 80px, 96px"
                            className="object-cover"
                            loading="lazy"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base font-semibold text-blue-900 group-hover:text-blue-700 truncate">
                            {similarListing.title}
                          </h3>
                          <div className="flex items-center text-gray-600 text-sm mt-1">
                            <MapPin size={14} className="shrink-0 mr-1 text-blue-500" />
                            <span className="truncate">{similarListing.location}</span>
                          </div>
                          <div className="text-lg font-bold text-blue-900 mt-1">
                            {similarListing.rate || 
                             (similarListing.price ? `₦${similarListing.price}/month` : 
                              similarListing.minPrice ? `From ₦${similarListing.minPrice}` : 'Contact for price')}
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
                <li>• Always meet potential housemates in person</li>
                <li>• Visit the property before making any payments</li>
                <li>• Never send money without signing an agreement</li>
                <li>• Trust your instincts about potential housemates</li>
                <li>• Keep your personal information private</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      <ListingReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        listing={{
          listingId: listing.id || listing.slug,
          listingTitle: listing.title,
          listingType: 'housemate',
          collectionName: 'housemates',
          listingSlug: listing.slug,
          listingPath: listing.slug ? `/housemate/${listing.slug}` : '',
          listingUrl: listing.slug ? `/housemate/${listing.slug}` : ''
        }}
      />
    </div>
  );
}
