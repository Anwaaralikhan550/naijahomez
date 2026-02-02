'use client';
import React, { useState, useEffect } from 'react';
import { use } from 'react';
import Link from 'next/link';
import { 
  MapPin, 
  Home, 
  Bath, 
  Car,
  Expand, 
  Share, 
  Heart, 
  Flag, 
  Calendar, 
  Briefcase,
  Wifi,
  Wind,
  Shield,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Tag,
  AlertTriangle,
  Phone,
  Mail,
  MessageCircle,
  Star
} from 'lucide-react';
import apiService from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import DOMPurify from 'isomorphic-dompurify';

// Helper function to format price with commas
function formatPrice(value) {
  if (!value) return '0';
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Helper function to extract price value from different formats
function extractPriceValue(property) {
  const propertyPrice = 
    (typeof property.price === 'number' ? property.price : null) ||
    (property.saleDetails?.price) ||
    (property.priceNumeric) ||
    (property.rate && typeof property.rate === 'string' 
      ? parseFloat(property.rate.replace(/[^0-9.]/g, '')) 
      : null) ||
    (typeof property.price === 'string' 
      ? parseFloat(property.price.replace(/[^0-9.]/g, ''))
      : 0);
  
  return !isNaN(propertyPrice) ? propertyPrice : 0;
}

// Helper function to determine if a property is for sale (when listingType field is missing)
function isForSale(property) {
  if (!property || !property.price) return false;
  
  // If property has explicit listingType, use it
  if (property.listingType) {
    return property.listingType === 'sale';
  }
  
  const priceString = String(property.price).toLowerCase();
  
  // Keywords that indicate rentals
  const rentKeywords = [
    '/month', '/year', '/annum', 
    'per month', 'per year', 'per annum',
    'monthly', 'annually', 'yearly',
    'rent', 'rental', 'to let'
  ];
  
  // If any rent keywords are found, it's NOT for sale
  return !rentKeywords.some(keyword => priceString.includes(keyword));
}

export default function PropertyDetail({ params }) {
  // Properly unwrap params
  const unwrappedParams = use(params);
  const slug = unwrappedParams.slug;
  
  const [property, setProperty] = useState(null);
  const [similarProperties, setSimilarProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [thumbnailsScrollPosition, setThumbnailsScrollPosition] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get authenticated user from context
  const { user } = useAuth();

  // Fetch property data
  useEffect(() => {
    let isMounted = true;
    
    const fetchProperty = async () => {
      try {
        setLoading(true);
        console.log('Fetching property with slug:', slug);
        
        const response = await apiService.getPropertyBySlug(slug);
        console.log('API response:', response);
        
        if (!response.success || !response.data) {
          setError('Property not found');
          return;
        }
        
        if (!isMounted) return;
        
        const propertyData = response.data;
        setProperty(propertyData);
        
        // Set initial main image if available
        if (propertyData.imageUrls && propertyData.imageUrls.length > 0) {
          setSelectedImage(0);
        }

        // Set similar properties from API response
        if (response.similar && response.similar.length > 0) {
          setSimilarProperties(response.similar);
        }
        
      } catch (err) {
        console.error('Error fetching property:', err);
        if (isMounted) {
          setError('Failed to load property details');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    fetchProperty();
    
    return () => {
      isMounted = false;
    };
  }, [slug]);

  // Handle image navigation
  const handlePrevImage = () => {
    if (!property || !property.imageUrls) return;
    setSelectedImage((prev) => 
      prev === 0 ? property.imageUrls.length - 1 : prev - 1
    );
  };

  const handleNextImage = () => {
    if (!property || !property.imageUrls) return;
    setSelectedImage((prev) => 
      prev === property.imageUrls.length - 1 ? 0 : prev + 1
    );
  };

  // Handle thumbnail scrolling
  const scrollThumbnails = (direction) => {
    const container = document.getElementById('thumbnails-container');
    if (container) {
      const scrollAmount = direction * (container.offsetWidth / 2);
      setThumbnailsScrollPosition(prev => prev + scrollAmount);
      container.scrollLeft += scrollAmount;
    }
  };

  const handleShareClick = () => {
    // Simple share functionality using Web Share API if available
    if (navigator.share) {
      navigator.share({
        title: property.title,
        text: `Check out this property: ${property.title}`,
        url: window.location.href,
      }).catch(error => console.log('Error sharing', error));
    } else {
      // Fallback to clipboard copy
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  const handleSaveClick = () => {
    setIsSaved(!isSaved);
    // In a real implementation, you would save this to the user's profile
    toast.success(isSaved ? 'Property removed from saved items' : 'Property saved to your favorites');
  };

  const handleReportClick = () => {
    // Simple alert for report functionality
    alert('Thank you for reporting this listing. Our team will review it shortly.');
  };

  const handleMessageSubmit = async (e) => {
    e.preventDefault();
    
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    setIsSubmitting(true);
    try {
      if (!user) {
        toast.error('Please sign in to send a message');
        // Redirect to login page
        window.location.href = '/login';
        return;
      }

      // Check if this is a scraped listing (no real userId)
      const isScrapedListing = !property.userId || property.userId === 'unknown' || property.userId === '';

      // For scraped listings, route to admin system user
      // For user listings, use the actual recipient
      const recipientId = isScrapedListing ? 'system-admin-scraped' : property.userId;

      const result = await apiService.sendMessage({
        message: message.trim(),
        recipientId: recipientId,
        senderId: user.uid,
        listingId: property.id,
        listingType: 'property',
        senderName: user.displayName || user.email || 'Anonymous',
        senderEmail: user.email,
        isScrapedListing: isScrapedListing,
        originalSellerPhone: property.phoneNumber || null,
        originalSellerEmail: property.agentEmail || property.email || null,
        originalSellerName: property.agentName || property.ownerName || null
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to send message');
      }
      
      // Enhanced success notification
      toast.success('✅ Message sent successfully!', {
        duration: 4000,
        position: 'top-center',
        style: {
          background: '#10B981',
          color: 'white',
          fontWeight: 'bold',
          padding: '16px',
          borderRadius: '8px',
          fontSize: '16px'
        },
        icon: '📧'
      });

      // Play notification sound
      try {
        const audio = new Audio('/notification-success.mp3');
        audio.volume = 0.3;
        audio.play().catch(() => {
          // Fallback: system notification sound if audio file not available
          console.log('🔔 Message sent notification');
        });
      } catch (e) {
        console.log('🔔 Audio notification not available');
      }

      // Show additional confirmation alert for important messages
      if (message.length > 100) {
        setTimeout(() => {
          toast('💡 Your detailed message has been forwarded to the seller', {
            duration: 3000,
            position: 'bottom-right',
            style: {
              background: '#3B82F6',
              color: 'white'
            }
          });
        }, 1000);
      }
      
      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Enhanced error notification
      toast.error(`❌ ${error.message || 'Failed to send message'}`, {
        duration: 5000,
        position: 'top-center',
        style: {
          background: '#EF4444',
          color: 'white',
          fontWeight: 'bold',
          padding: '16px',
          borderRadius: '8px',
          fontSize: '16px'
        },
        icon: '⚠️'
      });

      // Play error sound
      try {
        const audio = new Audio('/notification-error.mp3');
        audio.volume = 0.3;
        audio.play().catch(() => {
          console.log('🔔 Error notification');
        });
      } catch (e) {
        console.log('🔔 Audio notification not available');
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Get unique location text for similar properties display
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
  
  // Show loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading property details...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="bg-red-50 rounded-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-red-700 mb-4">{error}</h2>
          <p className="text-red-500 mb-4">We couldn't find the property you're looking for.</p>
          <Link href="/property" className="inline-block px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
            Browse All Properties
          </Link>
        </div>
      </div>
    );
  }

  // If no property data, show error
  if (!property) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="bg-red-50 rounded-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-red-700 mb-4">Property Not Found</h2>
          <p className="text-red-500 mb-4">The property you're looking for may have been removed or is no longer available.</p>
          <Link href="/property" className="inline-block px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
            Browse All Properties
          </Link>
        </div>
      </div>
    );
  }

  // Determine if property is for rent or sale
  const forSale = property.listingType === 'sale' || (!property.listingType && isForSale(property));

  // Safe access helper for nested properties
  const getNestedValue = (obj, path, fallback = '') => {
    if (!obj) return fallback;
    const keys = path.split('.');
    let value = obj;
    
    for (const key of keys) {
      if (value === null || value === undefined || !value.hasOwnProperty(key)) {
        return fallback;
      }
      value = value[key];
    }
    
    return value || fallback;
  };

  // Helper to get label for amenity
  const getAmenityLabel = (amenityValue) => {
    const amenityMap = {
      'estate_water': 'Estate Water',
      'estate_electricity': 'Estate/Private Electricity',
      'broadband_wifi': 'Broadband/Wi-Fi',
      'kitchen_appliances': 'Kitchen Appliances',
      'water_heater': 'Water Heater',
      'air_extractor': 'Air Extractor',
      'estate_security': 'Gated with Private Estate Security',
      'ensuite': 'Ensuite',
      'private_kitchen': 'Private Kitchen',
      'furnished': 'Furnished',
      'unfurnished': 'Unfurnished',
      'car_park': 'Car Park',
      '24hr_light': '24hrs Light',
      'gated_security': 'Gated with Security',
      'garden': 'Garden',
      'broadband': 'Broadband',
      'wifi': 'Wi-Fi',
      'laundry': 'Laundry',
      'bathroom': 'Private Bathroom',
      'ac': 'Air Conditioning'
    };
    return amenityMap[amenityValue] || amenityValue;
  };

  // Helper to get icon for amenity
  const getAmenityIcon = (amenityValue) => {
    const iconMap = {
      'estate_water': () => <span className="text-blue-500">💧</span>,
      'estate_electricity': () => <span className="text-yellow-500">⚡</span>,
      'broadband_wifi': () => <Wifi size={16} className="text-blue-500" />,
      'kitchen_appliances': () => <span className="text-gray-500">🍳</span>,
      'water_heater': () => <span className="text-red-500">🔥</span>,
      'air_extractor': () => <Wind size={16} className="text-gray-500" />,
      'estate_security': () => <Shield size={16} className="text-green-500" />,
      'ensuite': () => <Bath size={16} className="text-blue-500" />,
      'private_kitchen': () => <span className="text-orange-500">🍳</span>,
      'furnished': () => <Home size={16} className="text-blue-500" />,
      'unfurnished': () => <Home size={16} className="text-gray-500" />,
      'car_park': () => <Car size={16} className="text-blue-500" />,
      '24hr_light': () => <span className="text-yellow-500">💡</span>,
      'gated_security': () => <Shield size={16} className="text-green-500" />,
      'garden': () => <span className="text-green-500">🌿</span>,
      'broadband': () => <Wifi size={16} className="text-blue-500" />,
      'wifi': () => <Wifi size={16} className="text-blue-500" />,
      'laundry': () => <span className="text-blue-500">🧺</span>,
      'bathroom': () => <Bath size={16} className="text-blue-500" />,
      'ac': () => <Wind size={16} className="text-blue-500" />
    };
    const IconComponent = iconMap[amenityValue];
    return IconComponent ? IconComponent() : null;
  };

  // Check if this is an enhanced property
  const hasEnhancedDetails = property.address || 
                          property.rentAmount || 
                          property.fees || 
                          property.contact || 
                          property.amenities;

  // Safely access contact info                    
  // const phoneNumber = getNestedValue(property, 'contact.phone');
  const phoneNumber = property.phoneNumber;
  const contactEmail = getNestedValue(property, 'contact.email');
  const contactWebsite = getNestedValue(property, 'contact.website');
  
  // Prepare WhatsApp URL if phone is available
  const whatsappUrl = phoneNumber 
    ? `https://wa.me/${phoneNumber.replace(/\D/g, '')}?text=Hello, I'm interested in your property listing on Nijahomzs: ${property.title}` 
    : null;
  
  // Safely access amenities
  const amenities = Array.isArray(property.amenities) ? property.amenities : [];

  // Get valid images array and current image
  const images = property.imageUrls || [];
  const currentImage = images[selectedImage] || '';

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Property Header */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-3xl font-bold text-blue-900">{property.title}</h1>
              
              {/* Listing Type Badge */}
              <span className={`
                px-3 py-1 rounded-full text-sm font-medium
                ${property.listingType === 'sale' || (!property.listingType && isForSale(property))
                  ? 'bg-green-500 text-white' 
                  : 'bg-blue-500 text-white'}
              `}>
                {property.listingType === 'sale' || (!property.listingType && isForSale(property))
                  ? 'For Sale' 
                  : 'For Rent'}
              </span>
            </div>
            <div className="flex items-center text-gray-700 mb-2">
              <MapPin size={20} className="mr-2" />
              <span>{property.location}</span>
            </div>
          </div>
          <div className="md:text-right">
            <div className="text-3xl font-bold text-blue-900 mb-2">
              {property.listingType === 'sale' || (!property.listingType && isForSale(property))
                ? `₦${formatPrice(property.saleDetails?.price || extractPriceValue(property))}`
                : property.price || property.rate}
              
              {/* Negotiable indicator for sale properties */}
              {(property.listingType === 'sale' || (!property.listingType && isForSale(property))) && 
              property.saleDetails?.negotiable && (
                <span className="text-sm font-normal bg-green-100 text-green-800 px-2 py-1 rounded ml-2">
                  Negotiable
                </span>
              )}
            </div>
            <div className="flex flex-wrap md:justify-end gap-2">
              <span className="inline-block bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-sm font-medium">
                {property.propertyType || property.type || 'Property'}
              </span>
              {/* Keep any other original buttons here */}
            </div>
          </div>
        </div>

        {/* Main Content - Two Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left Column - Gallery & Details */}
          <div className="md:col-span-2 space-y-6">
            {/* Image Gallery */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              {/* Main Image */}
              <div className="relative w-full aspect-[4/3] bg-gray-100">
                {images.length > 0 ? (
                  <div className="relative h-full">
                    <img
                      src={currentImage}
                      alt={`Property view ${selectedImage + 1}`}
                      className="w-full h-full object-cover"
                      loading="eager"
                    />
                  
                    {/* Image Navigation Controls */}
                    <div className="absolute inset-0 flex items-center justify-between px-4">
                      <button
                        onClick={handlePrevImage}
                        className="bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition"
                        aria-label="Previous image"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <button
                        onClick={handleNextImage}
                        className="bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition"
                        aria-label="Next image"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </div>
                    
                    {/* Fullscreen Toggle */}
                    <button
                      onClick={() => setIsFullscreen(true)}
                      className="absolute top-3 right-3 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition"
                      aria-label="Toggle fullscreen"
                    >
                      <Maximize2 size={20} />
                    </button>
                    
                    {/* Image Counter */}
                    <div className="absolute bottom-3 right-3 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                      {selectedImage + 1} / {images.length}
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-gray-400">No image available</span>
                  </div>
                )}
              </div>
              
              {/* Thumbnails with scroll buttons */}
              {images.length > 1 && (
                <div className="p-4 relative">
                  {/* Left scroll button */}
                  {images.length > 5 && (
                    <button 
                      onClick={() => scrollThumbnails(-1)}
                      className="absolute left-2 top-1/2 transform -translate-y-1/2 z-10 bg-gray-200 text-gray-700 p-1 rounded-full hover:bg-gray-300"
                      aria-label="Scroll thumbnails left"
                    >
                      <ChevronLeft size={16} />
                    </button>
                  )}
                  
                  {/* Thumbnails container */}
                  <div 
                    id="thumbnails-container"
                    className="flex gap-2 overflow-x-auto px-6 scrollbar-hide scroll-smooth"
                    style={{ scrollBehavior: 'smooth' }}
                  >
                    {images.map((image, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedImage(index)}
                        className={`flex-shrink-0 w-20 h-20 rounded-md overflow-hidden transition
                          ${selectedImage === index ? 'ring-2 ring-blue-500 scale-105' : 'opacity-70 hover:opacity-100'}`}
                      >
                        <img
                          src={image}
                          alt={`Thumbnail ${index + 1}`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                  
                  {/* Right scroll button */}
                  {images.length > 5 && (
                    <button 
                      onClick={() => scrollThumbnails(1)}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 z-10 bg-gray-200 text-gray-700 p-1 rounded-full hover:bg-gray-300"
                      aria-label="Scroll thumbnails right"
                    >
                      <ChevronRight size={16} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Property Details */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-blue-900 mb-4">Property Details</h2>
              
              {/* Standard Details - Always shown */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 mb-6">
                <div className="flex flex-col items-center text-center">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                    <Home size={20} className="text-blue-600" />
                  </div>
                  <span className="text-sm text-gray-600">Bedrooms</span>
                  <span className="font-semibold text-gray-900">{property.bedrooms || '-'}</span>
                </div>
                
                <div className="flex flex-col items-center text-center">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                    <Bath size={20} className="text-blue-600" />
                  </div>
                  <span className="text-sm text-gray-600">Bathrooms</span>
                  <span className="font-semibold text-gray-900">{property.bathrooms || '-'}</span>
                </div>
                
                <div className="flex flex-col items-center text-center">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                    <Expand size={20} className="text-blue-600" />
                  </div>
                  <span className="text-sm text-gray-600">Size</span>
                  <span className="font-semibold text-gray-900">
                    {property.squareMeters ? `${property.squareMeters} m²` : '-'}
                  </span>
                </div>
                
                <div className="flex flex-col items-center text-center">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                    <Tag size={20} className="text-blue-600" />
                  </div>
                  <span className="text-sm text-gray-600">Property Type</span>
                  <span className="font-semibold text-gray-900">
                    {property.propertyType ? property.propertyType.charAt(0).toUpperCase() + property.propertyType.slice(1) : '-'}
                  </span>
                </div>
              </div>

              {/* Enhanced Details - Only shown for new format properties */}
              {hasEnhancedDetails && (
                <>
                  <div className="border-t my-6"></div>
                  
                  {/* Address Section */}
                  {property.address && (
                    <div className="mb-6">
                      <h3 className="font-medium text-gray-900 mb-2">Full Address</h3>
                      <div className="grid md:grid-cols-3 gap-4">
                        {getNestedValue(property, 'address.street') && (
                          <div>
                            <span className="text-sm text-gray-500 block">Street</span>
                            <span className="text-gray-900">{getNestedValue(property, 'address.street')}</span>
                          </div>
                        )}
                        {getNestedValue(property, 'address.town') && (
                          <div>
                            <span className="text-sm text-gray-500 block">Town</span>
                            <span className="text-gray-900">{getNestedValue(property, 'address.town')}</span>
                          </div>
                        )}
                        {getNestedValue(property, 'address.state') && (
                          <div>
                            <span className="text-sm text-gray-500 block">State</span>
                            <span className="text-gray-900">{getNestedValue(property, 'address.state')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Additional Features */}
                  <div className="mb-6">
                    <h3 className="font-medium text-gray-900 mb-2">Additional Features</h3>
                    <div className="grid md:grid-cols-3 gap-y-4">
                      {/* Boys Quarters */}
                      {property.boysQuarters && (
                        <div className="flex items-center gap-2">
                          <Home size={16} className="text-blue-500" />
                          <span className="text-gray-800">
                            {getNestedValue(property, 'boysQuarters.available', false)
                              ? `Boys Quarters: ${getNestedValue(property, 'boysQuarters.rooms', 1)} Room(s)` 
                              : 'No Boys Quarters'}
                          </span>
                        </div>
                      )}
                      
                      {/* Parking */}
                      {property.parking && (
                        <div className="flex items-center gap-2">
                          <Car size={16} className="text-blue-500" />
                          <span className="text-gray-800">
                            {getNestedValue(property, 'parking.available', false)
                              ? `Parking: ${getNestedValue(property, 'parking.spaces', 1)} Space(s)` 
                              : 'No Parking Space'}
                          </span>
                        </div>
                      )}
                      
                      {/* Furnishing */}
                      {property.furnishing && (
                        <div className="flex items-center gap-2">
                          <Briefcase size={16} className="text-blue-500" />
                          <span className="text-gray-800">
                            {property.furnishing === 'furnished' ? 'Furnished' : 'Not Furnished'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Amenities */}
                  {amenities.length > 0 && (
                    <div className="mb-6">
                      <h3 className="font-medium text-gray-900 mb-2">Amenities</h3>
                      <div className="grid md:grid-cols-2 gap-y-2 gap-x-4">
                        {amenities.map((amenity) => (
                          <div key={amenity} className="flex items-center gap-2">
                            {getAmenityIcon(amenity)}
                            <span className="text-gray-800">{getAmenityLabel(amenity)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            
            {/* For Sale Specific Details */}
            {forSale && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-blue-900 mb-4">Sale Details</h2>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-y-6 mb-6">
                  {/* Title Document */}
                  {property.saleDetails?.titleDocument && (
                    <div className="flex flex-col items-center text-center">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mb-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <span className="text-sm text-gray-600">Title Document</span>
                      <span className="font-semibold text-gray-900">{property.saleDetails.titleDocument}</span>
                    </div>
                  )}
                  
                  {/* Year Built */}
                  {property.saleDetails?.yearBuilt && (
                    <div className="flex flex-col items-center text-center">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <span className="text-sm text-gray-600">Year Built</span>
                      <span className="font-semibold text-gray-900">{property.saleDetails.yearBuilt}</span>
                    </div>
                  )}
                  
                  {/* Negotiable */}
                  <div className="flex flex-col items-center text-center">
                    <div className={`w-10 h-10 ${property.saleDetails?.negotiable ? 'bg-green-100' : 'bg-gray-100'} rounded-full flex items-center justify-center mb-2`}>
                      <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${property.saleDetails?.negotiable ? 'text-green-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <span className="text-sm text-gray-600">Price Negotiable</span>
                    <span className="font-semibold text-gray-900">{property.saleDetails?.negotiable ? 'Yes' : 'No'}</span>
                  </div>
                </div>
                
                {/* Price information for sale properties */}
                <div className="p-4 bg-green-50 rounded-lg mt-2">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign size={18} className="text-green-600" />
                    <h3 className="font-medium text-green-800">Price Information</h3>
                  </div>
                  <p className="text-gray-700 mb-2">
                    <span className="font-bold text-xl text-green-800">
                      {property.price || (property.priceNumeric ? `₦${formatPrice(property.priceNumeric)}` : 'Contact agent for price')}
                    </span>
                    {property.saleDetails?.negotiable && <span className="ml-2 text-green-700">(Negotiable)</span>}
                  </p>
                  
                  {/* Purchase warning notice */}
                  <div className="flex items-start gap-2 mt-4 text-sm bg-yellow-50 p-3 rounded-lg">
                    <AlertTriangle size={18} className="text-yellow-600 shrink-0 mt-0.5" />
                    <p className="text-yellow-700">
                      Always verify property documents and conduct proper due diligence before making any payment. 
                      We recommend engaging a qualified lawyer for property transactions.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* For Rent Specific Details */}
            {(property.listingType === 'rent' || (property.listingType !== 'sale' && !isForSale(property))) && (
              <div className="bg-white rounded-lg shadow-md p-6 mt-6">
                <h2 className="text-xl font-semibold text-blue-900 mb-4">Rental Terms</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Payment Terms */}
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h3 className="font-medium text-blue-900 mb-2">Payment Terms</h3>
                    <div className="flex flex-wrap gap-2">
                      {property.rentAmount?.monthly && (
                        <div className="flex items-center justify-between w-full">
                          <span className="text-gray-700">Monthly Rent:</span>
                          <span className="font-semibold">₦{formatPrice(property.rentAmount.monthly)}</span>
                        </div>
                      )}
                      {property.rentAmount?.annual && (
                        <div className="flex items-center justify-between w-full">
                          <span className="text-gray-700">Annual Rent:</span>
                          <span className="font-semibold">₦{formatPrice(property.rentAmount.annual)}</span>
                        </div>
                      )}
                      {!property.rentAmount && (
                        <div className="text-gray-700">
                          {property.price || property.rate || "Contact agent for payment details"}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Fees */}
                  {property.fees && (
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h3 className="font-medium text-blue-900 mb-2">Additional Fees</h3>
                      <div className="space-y-1">
                        {/* Agency Fee */}
                        {property.fees.agency && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-700">Agency Fee:</span>
                            <span className="font-semibold">
                              {property.fees.agency.type === 'percentage' 
                                ? `${property.fees.agency.value}%` 
                                : `₦${formatPrice(property.fees.agency.value)}`}
                            </span>
                          </div>
                        )}
                        
                        {/* Legal Fee */}
                        {property.fees.legal && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-700">Legal Fee:</span>
                            <span className="font-semibold">
                              {property.fees.legal.type === 'percentage' 
                                ? `${property.fees.legal.value}%` 
                                : `₦${formatPrice(property.fees.legal.value)}`}
                            </span>
                          </div>
                        )}
                        
                        {/* Caution Fee */}
                        {property.fees.caution && property.fees.caution.required && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-700">Caution/Security Deposit:</span>
                            <span className="font-semibold">
                              ₦{formatPrice(property.fees.caution.value)}
                            </span>
                          </div>
                        )}
                        
                        {/* Service Charge */}
                        {property.fees.service && property.fees.service.required && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-700">Service Charge:</span>
                            <span className="font-semibold">
                              {property.fees.service.type === 'percentage' 
                                ? `${property.fees.service.value}%` 
                                : `₦${formatPrice(property.fees.service.value)}`}
                            </span>
                          </div>
                        )}
                        
                        {/* Other Fees */}
                        {property.fees.other && property.fees.other.length > 0 && 
                          property.fees.other.map((fee, index) => (
                            <div key={index} className="flex items-center justify-between">
                              <span className="text-gray-700">{fee.name}:</span>
                              <span className="font-semibold">
                                ₦{formatPrice(fee.amount)}
                              </span>
                            </div>
                          ))
                        }
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Property Description */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-blue-900 mb-4">About This Property</h2>
              <div
                className="prose max-w-none text-gray-700"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(property.description || '') }}
              />
            </div>

            {/* Property Actions */}
            <div className="flex flex-wrap gap-4">
              <button
                onClick={handleSaveClick}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors
                  ${isSaved 
                    ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' 
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'}`}
              >
                <Heart size={20} fill={isSaved ? "currentColor" : "none"} />
                <span>{isSaved ? 'Saved' : 'Save'}</span>
              </button>
              
              <button
                onClick={handleShareClick}
                className="flex items-center gap-2 px-4 py-2 bg-gray-50 text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
              >
                <Share size={20} />
                <span>Share</span>
              </button>
              
              <button
                onClick={handleReportClick}
                className="flex items-center gap-2 px-4 py-2 bg-gray-50 text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
              >
                <Flag size={20} />
                <span>Report Listing</span>
              </button>
            </div>
          </div>
          
          {/* Right Column - Contact & Similar */}
          <div className="md:col-span-1 space-y-6">
            {/* Agent/Seller Info Card */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-lg font-semibold text-blue-900 mb-6 border-b pb-4">
                Contact {property.agent?.name ? 'Agent' : 'Seller'}
              </h2>
              
              {/* Agent/Seller Profile */}
              <div className="flex items-start gap-4 mb-6">
                <div className="w-16 h-16 bg-blue-100 rounded-full overflow-hidden flex-shrink-0">
                  <img
                    src={property.agent?.photoURL || property.userPhotoURL || "/api/placeholder/400/400"}
                    alt={property.agent?.name || property.userName || "User"}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {property.agent?.name || property.userName || "Contact Seller"}
                  </h3>
                  {property.agent?.title && <p className="text-blue-600 text-sm">{property.agent.title}</p>}
                  
                  {/* Only show ratings if they exist */}
                  {property.agent?.rating && property.agent?.reviewCount && (
                    <div className="flex items-center gap-1 text-yellow-500 mt-1">
                      <Star size={16} fill="currentColor" />
                      <span className="text-gray-600 text-sm">
                        {property.agent.rating} ({property.agent.reviewCount} reviews)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Contact Information - Only show this section if there's at least one contact method */}
              {(phoneNumber || contactEmail) && (
                <div className="space-y-3 mb-6">
                  
                  {/* Only show email if actually provided */}
                  {contactEmail && (
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-500 text-white p-2 rounded-full">
                        <Mail size={16} />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Email</p>
                        <p className="text-gray-900">{contactEmail}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Only show office location if actually provided */}
                  {property.agent?.office && (
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-500 text-white p-2 rounded-full">
                        <MapPin size={16} />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Location</p>
                        <p className="text-gray-900">{property.agent.office}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Contact Form */}
              <form onSubmit={handleMessageSubmit} className="space-y-4">
                <h4 className="font-medium text-gray-900">Send Message</h4>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="I'm interested in this listing and would like to know more about it..."
                  className="w-full p-3 border rounded-lg text-gray-700 bg-gray-50 min-h-[100px] resize-none"
                  rows="4"
                />
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-blue-500 text-white py-3 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <MessageCircle size={18} />
                  {isSubmitting ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            </div>

            {/* WhatsApp button only if phone number exists */}
            {phoneNumber && (
              showPhone ? (
                <div className="bg-white rounded-lg shadow-md p-4 text-center">
                  <div className="w-full bg-green-100 text-green-800 py-3 px-4 rounded-lg space-y-2">
                    <p className="font-medium">WhatsApp Number</p>
                    <a 
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xl font-bold block hover:text-green-700 flex items-center justify-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-green-600">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      {phoneNumber}
                    </a>
                    <button 
                      type="button"
                      onClick={() => setShowPhone(false)}
                      className="text-sm text-green-700 hover:text-green-800"
                    >
                      Hide Number
                    </button>
                  </div>
                </div>
              ) : (
                <button 
                  type="button"
                  onClick={() => setShowPhone(true)}
                  className="w-full bg-green-500 text-white py-4 rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="mr-1">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  <span>Contact via WhatsApp</span>
                </button>
              )
            )}
            
            {/* Similar Properties */}
            {similarProperties.length > 0 ? (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-lg font-semibold text-blue-900 mb-6 border-b pb-4">
                  Similar Properties in this Area
                </h2>
                <div className="space-y-4">
                  {similarProperties.map((similarProperty) => (
                    <Link 
                      key={similarProperty.id} 
                      href={`/property/${similarProperty.slug}`}
                      className="block group"
                    >
                      <div className="flex items-start gap-3">
                        <img
                          src={similarProperty.imageUrls?.[0] || '/api/placeholder/400/300'}
                          alt={similarProperty.title}
                          className="w-20 h-16 md:w-24 md:h-20 object-cover rounded-lg shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base font-semibold text-blue-900 group-hover:text-blue-700 truncate">
                            {similarProperty.title}
                          </h3>
                          <div className="flex items-center text-gray-600 text-sm mt-1">
                            <MapPin size={14} className="shrink-0 mr-1 text-blue-500" />
                            <span className="truncate">{getLocationText(similarProperty.location)}</span>
                          </div>
                          
                          {/* Update this to handle sale vs rent price display */}
                          <div className="text-lg font-bold text-blue-900 mt-1">
                            {similarProperty.listingType === 'sale' || (!similarProperty.listingType && isForSale(similarProperty))
                              ? `₦${formatPrice(similarProperty.saleDetails?.price || extractPriceValue(similarProperty))}`
                              : similarProperty.rate || similarProperty.price}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-lg font-semibold text-blue-900 mb-6 border-b pb-4">
                  Similar Properties in this Area
                </h2>
                <div className="text-center py-8">
                  <p className="text-gray-500">Looking for similar properties...</p>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Fullscreen Image Modal */}
        {isFullscreen && (
          <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
            <button
              onClick={() => setIsFullscreen(false)}
              className="absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full z-10"
            >
              <Minimize2 size={24} />
            </button>
            
            <button
              onClick={handlePrevImage}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full z-10"
            >
              <ChevronLeft size={24} />
            </button>

            <img
              src={currentImage}
              alt="Full screen view"
              className="max-h-screen max-w-full object-contain"
            />

            <button
              onClick={handleNextImage}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full z-10"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        )}
        
        <style jsx>{`
          .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
        `}</style>
      </div>
    </div>
  );
}