import React, { useState, useEffect } from 'react';
// Replaced with API service calls
import apiService from '@/services/api';
import { ImageGallery } from '@/components/property/ImageGallery';
import { 
  MapPin, 
  Clock, 
  AlertTriangle, 
  Heart, 
  Share2, 
  Star, 
  Briefcase, 
  GraduationCap, 
  ShieldCheck, 
  Book, 
  Layers, 
  CheckCircle, 
  Award,
  Map
} from 'lucide-react';
import Link from 'next/link';
import ContactAgent from '@/components/shared/ContactAgent';
import toast from 'react-hot-toast';

export default function TradespeopleDetail({ params }) {
  // Use React.use() to unwrap params
  const resolvedParams = React.use(params);
  
  const [service, setService] = useState(null);
  const [similarServices, setSimilarServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewCount, setViewCount] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('description');

  useEffect(() => {
    const loadServiceData = async () => {
      try {
        // Get service by slug using API service
        const response = await apiService.getTradespersonBySlug(resolvedParams.slug);
        
        if (!response || !response.data) {
          setError('Service not found');
          return;
        }

        const serviceData = response.data;
        setService(serviceData);
        
        // Track this view if needed
        if (serviceData.viewCount) {
          setViewCount(serviceData.viewCount);
        }

        // Use similar services from API response
        setSimilarServices(response.similar || []);
      } catch (error) {
        console.error('Error loading service:', error);
        setError('Failed to load service data');
      } finally {
        setLoading(false);
      }
    };

    loadServiceData();
  }, [resolvedParams.slug]);

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: service.title,
          text: `Check out this service: ${service.title}`,
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
  };

  // Format price with commas
  const formatPrice = (value) => {
    if (!value) return '';
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  // Helper function to get business type display label
  const getBusinessTypeLabel = (type) => {
    const businessTypes = {
      'sole_trader': 'Sole Trader/Freelancer',
      'small_company': 'Small Company (1-10 employees)',
      'medium_company': 'Medium Company (11-50 employees)',
      'large_company': 'Large Company (50+ employees)'
    };
    return businessTypes[type] || type;
  };

  // Helper function to get charge type display label
  const getChargeTypeLabel = (type) => {
    const chargeTypes = {
      'fixed_rate': 'Fixed Rate',
      'hourly_rate': 'Hourly Rate',
      'both_rates': 'Fixed & Hourly Rates',
      'price_range': 'Price Range',
      'negotiable': 'Negotiable'
    };
    return chargeTypes[type] || type;
  };

  // Function to calculate listing age
  const getListingAge = () => {
    if (!service.createdAt) return null;
    
    const createdDate = service.createdAt.seconds 
      ? new Date(service.createdAt.seconds * 1000) 
      : new Date(service.createdAt);
    
    const now = new Date();
    const diffTime = Math.abs(now - createdDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Listed today";
    if (diffDays === 1) return "Listed yesterday";
    if (diffDays < 7) return `Listed ${diffDays} days ago`;
    if (diffDays < 30) return `Listed ${Math.floor(diffDays / 7)} ${Math.floor(diffDays / 7) === 1 ? 'week' : 'weeks'} ago`;
    
    return `Listed ${Math.floor(diffDays / 30)} ${Math.floor(diffDays / 30) === 1 ? 'month' : 'months'} ago`;
  };

  // Helper function to render price information
  const renderPriceInfo = () => {
    if (service.priceString) {
      return service.priceString;
    }
    
    // Handle different charge types
    if (service.chargeType === 'fixed_rate' && service.fixedRate) {
      return `₦${formatPrice(service.fixedRate)} fixed rate`;
    }
    
    if (service.chargeType === 'hourly_rate' && service.hourlyRate) {
      return `₦${formatPrice(service.hourlyRate)}/hour`;
    }
    
    if (service.chargeType === 'both_rates') {
      if (service.fixedRate && service.hourlyRate) {
        return `₦${formatPrice(service.fixedRate)} fixed or ₦${formatPrice(service.hourlyRate)}/hour`;
      }
    }
    
    if (service.chargeType === 'price_range' && service.minPrice && service.maxPrice) {
      return `₦${formatPrice(service.minPrice)} - ₦${formatPrice(service.maxPrice)}`;
    }
    
    if (service.chargeType === 'negotiable') {
      return 'Price Negotiable';
    }
    
    if (service.price) {
      return `₦${formatPrice(service.price)}`;
    }
    
    return 'Contact for pricing';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading service details...</p>
        </div>
      </div>
    );
  }

  if (error || !service) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center bg-red-50 p-8 rounded-xl shadow-lg max-w-lg mx-4">
          <div className="bg-red-500 text-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-red-600 text-2xl font-bold mb-4">
            {error || 'Service could not be found'}
          </h2>
          <p className="text-red-500 mb-6">
            Please check the link or try again later.
          </p>
          <Link 
            href="/tradespeople" 
            className="inline-block bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Browse Tradespeople
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
          <Link href="/tradespeople" className="hover:text-blue-500">
            Tradespeople
          </Link>
          <span>/</span>
          <span className="text-gray-900">{service.title}</span>
        </div>

        {/* Service Header */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
          <div className="p-6 bg-blue-50 border-b border-blue-100">
            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-xl md:text-2xl font-bold text-blue-900">
                    {service.title}
                  </h1>
                  {service.serviceType && (
                    <span className="bg-blue-500 text-white px-2 py-0.5 rounded-full text-sm">
                      {service.serviceType}
                    </span>
                  )}
                </div>
                
                {service.businessType && (
                  <div className="flex items-center text-purple-700 mb-2">
                    <Briefcase size={18} className="mr-2 text-purple-500" />
                    <span className="text-base">{getBusinessTypeLabel(service.businessType)}</span>
                  </div>
                )}
                
                {service.location && (
                  <div className="flex items-center text-gray-700 mb-2">
                    <MapPin size={18} className="mr-2 text-blue-500" />
                    <span className="text-base">{service.location}</span>
                  </div>
                )}
                
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  {service.rating && service.reviewCount && (
                    <div className="flex items-center">
                      <Star size={16} className="text-orange-500 mr-1" />
                      <span className="font-medium">{service.rating}</span>
                      <span className="text-gray-500 ml-1">({service.reviewCount} reviews)</span>
                    </div>
                  )}
                  
                  {service.experience && (
                    <div className="flex items-center">
                      <Award size={16} className="text-blue-500 mr-1" />
                      <span>{service.experience} year{parseInt(service.experience) !== 1 ? 's' : ''} experience</span>
                    </div>
                  )}
                  
                  {service.createdAt && (
                    <div className="flex items-center">
                      <Clock size={16} className="mr-1 text-gray-500" />
                      <span>{getListingAge()}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="text-left md:text-right">
                <div className="text-xl md:text-2xl font-bold text-blue-900 mb-2">
                  {renderPriceInfo()}
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
          {/* Main Content */}
          <div className="md:col-span-2 space-y-8">
            {/* Image Gallery */}
            {service.imageUrls && service.imageUrls.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <ImageGallery images={service.imageUrls} />
              </div>
            )}

            {/* Tabbed Content */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              {/* Tab Navigation */}
              <div className="flex border-b">
                <button
                  onClick={() => setActiveTab('description')}
                  className={`px-4 py-3 font-medium border-b-2 ${
                    activeTab === 'description'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Description
                </button>
                <button
                  onClick={() => setActiveTab('details')}
                  className={`px-4 py-3 font-medium border-b-2 ${
                    activeTab === 'details'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Service Details
                </button>
                <button
                  onClick={() => setActiveTab('qualifications')}
                  className={`px-4 py-3 font-medium border-b-2 ${
                    activeTab === 'qualifications'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Qualifications
                </button>
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {/* Description Tab */}
                {activeTab === 'description' && (
                  <div className="prose max-w-none">
                    <h3 className="text-xl font-semibold text-blue-900 mb-4">About This Service</h3>
                    <p className="whitespace-pre-wrap text-gray-700">{service.description}</p>
                    
                    {service.specializations && (
                      <div className="mt-6">
                        <h4 className="text-lg font-semibold text-blue-900 mb-2">Specializations</h4>
                        <p className="text-gray-700">{service.specializations}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Service Details Tab */}
                {activeTab === 'details' && (
                  <div>
                    <h3 className="text-xl font-semibold text-blue-900 mb-4">Service Information</h3>
                    
                    <div className="grid md:grid-cols-2 gap-x-8 gap-y-4">
                      {/* Service Type */}
                      {service.serviceType && (
                        <div className="flex items-start gap-3">
                          <div className="mt-1 bg-blue-100 rounded-full p-1">
                            <Briefcase className="text-blue-500 w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-gray-500">Service Type</h4>
                            <p className="text-gray-900">{service.serviceType}</p>
                          </div>
                        </div>
                      )}
                      
                      {/* Business Type */}
                      {service.businessType && (
                        <div className="flex items-start gap-3">
                          <div className="mt-1 bg-purple-100 rounded-full p-1">
                            <Briefcase className="text-purple-500 w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-gray-500">Business Type</h4>
                            <p className="text-gray-900">{getBusinessTypeLabel(service.businessType)}</p>
                          </div>
                        </div>
                      )}
                      
                      {/* Experience */}
                      {service.experience && (
                        <div className="flex items-start gap-3">
                          <div className="mt-1 bg-green-100 rounded-full p-1">
                            <Award className="text-green-500 w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-gray-500">Experience</h4>
                            <p className="text-gray-900">{service.experience} year{parseInt(service.experience) !== 1 ? 's' : ''}</p>
                          </div>
                        </div>
                      )}
                      
                      {/* Availability */}
                      {service.availability && (
                        <div className="flex items-start gap-3">
                          <div className="mt-1 bg-amber-100 rounded-full p-1">
                            <Clock className="text-amber-500 w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-gray-500">Availability</h4>
                            <p className="text-gray-900">{service.availability}</p>
                          </div>
                        </div>
                      )}
                      
                      {/* Areas Covered */}
                      {service.areasCovered && (
                        <div className="flex items-start gap-3">
                          <div className="mt-1 bg-indigo-100 rounded-full p-1">
                            <Map className="text-indigo-500 w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-gray-500">Areas Covered</h4>
                            <p className="text-gray-900">{service.areasCovered}</p>
                          </div>
                        </div>
                      )}
                      
                      {/* Capacity */}
                      {service.capacitySize && (
                        <div className="flex items-start gap-3">
                          <div className="mt-1 bg-blue-100 rounded-full p-1">
                            <Layers className="text-blue-500 w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-gray-500">Project Capacity</h4>
                            <p className="text-gray-900">{service.capacitySize}</p>
                          </div>
                        </div>
                      )}
                      
                      {/* Charge Type */}
                      {service.chargeType && (
                        <div className="flex items-start gap-3">
                          <div className="mt-1 bg-green-100 rounded-full p-1">
                            <CheckCircle className="text-green-500 w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-gray-500">Charge Type</h4>
                            <p className="text-gray-900">{getChargeTypeLabel(service.chargeType)}</p>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Pricing Details */}
                    <div className="mt-8">
                      <h4 className="text-lg font-semibold text-blue-900 mb-3">Pricing Details</h4>
                      <div className="bg-blue-50 rounded-lg p-4">
                        {service.chargeType === 'fixed_rate' && service.fixedRate && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-700">Fixed Rate:</span>
                            <span className="text-lg font-semibold text-blue-700">₦{formatPrice(service.fixedRate)}</span>
                          </div>
                        )}
                        
                        {service.chargeType === 'hourly_rate' && service.hourlyRate && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-700">Hourly Rate:</span>
                            <span className="text-lg font-semibold text-blue-700">₦{formatPrice(service.hourlyRate)}/hour</span>
                          </div>
                        )}
                        
                        {service.chargeType === 'both_rates' && (
                          <>
                            {service.fixedRate && (
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-gray-700">Fixed Rate:</span>
                                <span className="text-lg font-semibold text-blue-700">₦{formatPrice(service.fixedRate)}</span>
                              </div>
                            )}
                            {service.hourlyRate && (
                              <div className="flex justify-between items-center">
                                <span className="text-gray-700">Hourly Rate:</span>
                                <span className="text-lg font-semibold text-blue-700">₦{formatPrice(service.hourlyRate)}/hour</span>
                              </div>
                            )}
                          </>
                        )}
                        
                        {service.chargeType === 'price_range' && (
                          <>
                            {service.minPrice && (
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-gray-700">Minimum Price:</span>
                                <span className="text-lg font-semibold text-blue-700">₦{formatPrice(service.minPrice)}</span>
                              </div>
                            )}
                            {service.maxPrice && (
                              <div className="flex justify-between items-center">
                                <span className="text-gray-700">Maximum Price:</span>
                                <span className="text-lg font-semibold text-blue-700">₦{formatPrice(service.maxPrice)}</span>
                              </div>
                            )}
                          </>
                        )}
                        
                        {service.chargeType === 'negotiable' && (
                          <div className="text-center py-2">
                            <span className="text-lg font-semibold text-blue-700">Price Negotiable</span>
                          </div>
                        )}
                        
                        {!service.chargeType && service.price && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-700">Price:</span>
                            <span className="text-lg font-semibold text-blue-700">₦{formatPrice(service.price)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Qualifications Tab */}
                {activeTab === 'qualifications' && (
                  <div>
                    <h3 className="text-xl font-semibold text-blue-900 mb-4">Professional Background</h3>
                    
                    {/* Qualifications */}
                    {service.qualifications && (
                      <div className="mb-6">
                        <h4 className="flex items-center text-lg font-semibold text-blue-900 mb-2">
                          <GraduationCap className="mr-2 text-blue-500" size={20} />
                          Qualifications
                        </h4>
                        <p className="text-gray-700 ml-7">{service.qualifications}</p>
                      </div>
                    )}
                    
                    {/* Certifications */}
                    {service.certificationsLicenses && (
                      <div className="mb-6">
                        <h4 className="flex items-center text-lg font-semibold text-blue-900 mb-2">
                          <Award className="mr-2 text-blue-500" size={20} />
                          Certifications & Licenses
                        </h4>
                        <p className="text-gray-700 ml-7">{service.certificationsLicenses}</p>
                      </div>
                    )}
                    
                    {/* Insurance Details */}
                    {service.insuranceDetails && (
                      <div className="mb-6">
                        <h4 className="flex items-center text-lg font-semibold text-blue-900 mb-2">
                          <ShieldCheck className="mr-2 text-blue-500" size={20} />
                          Insurance Details
                        </h4>
                        <p className="text-gray-700 ml-7">{service.insuranceDetails}</p>
                      </div>
                    )}
                    
                    {/* Experience */}
                    {service.experience && (
                      <div className="mb-6">
                        <h4 className="flex items-center text-lg font-semibold text-blue-900 mb-2">
                          <Briefcase className="mr-2 text-blue-500" size={20} />
                          Experience
                        </h4>
                        <p className="text-gray-700 ml-7">{service.experience} year{parseInt(service.experience) !== 1 ? 's' : ''} of professional experience in {service.serviceType || 'this field'}</p>
                      </div>
                    )}
                    
                    {/* If no qualifications data is available */}
                    {!service.qualifications && !service.certificationsLicenses && !service.insuranceDetails && !service.experience && (
                      <p className="text-gray-500 italic">No qualification information provided.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Contact Section */}
          <div className="md:col-span-1 space-y-8">
            <ContactAgent 
              agent={{
                id: service.userId,
                name: service.provider || service.userName,
                title: service.serviceType ? `${service.serviceType} Professional` : "Service Provider",
                rating: service.rating && service.reviewCount ? service.rating : null,
                reviewCount: service.reviewCount || null,
                email: service.userEmail,
                photoURL: service.userPhotoURL,
              }}
              // Pass phone number directly from the service data
              phoneNumber={service.phoneNumber || service.providerContact}
              // Pass listing creation date for accurate "listed X days ago"
              createdAt={service.createdAt}
              // Pass view count if tracking views
              viewCount={viewCount}
              // Pass listing information for message context
              listingId={service.id}
              listingType="tradespeople"
            />

            {/* Business Highlights Card */}
            {(service.businessType || service.experience || service.qualifications || service.insuranceDetails) && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-lg font-semibold text-blue-900 mb-4 border-b pb-4">
                  Business Highlights
                </h2>
                <div className="space-y-4">
                  {service.businessType && (
                    <div className="flex items-start gap-3">
                      <div className="bg-blue-100 rounded-full p-2 mt-1">
                        <Briefcase className="w-4 h-4 text-blue-500" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">Type of Business</h3>
                        <p className="text-gray-600">{getBusinessTypeLabel(service.businessType)}</p>
                      </div>
                    </div>
                  )}
                  
                  {service.experience && (
                    <div className="flex items-start gap-3">
                      <div className="bg-green-100 rounded-full p-2 mt-1">
                        <Award className="w-4 h-4 text-green-500" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">Experience</h3>
                        <p className="text-gray-600">{service.experience} years in the industry</p>
                      </div>
                    </div>
                  )}
                  
                  {service.qualifications && (
                    <div className="flex items-start gap-3">
                      <div className="bg-purple-100 rounded-full p-2 mt-1">
                        <GraduationCap className="w-4 h-4 text-purple-500" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">Qualified Professional</h3>
                        <p className="text-gray-600">Certified & Trained</p>
                      </div>
                    </div>
                  )}
                  
                  {service.insuranceDetails && (
                    <div className="flex items-start gap-3">
                      <div className="bg-teal-100 rounded-full p-2 mt-1">
                        <ShieldCheck className="w-4 h-4 text-teal-500" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">Insured</h3>
                        <p className="text-gray-600">Professional liability coverage</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Similar Services */}
            {similarServices.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-lg font-semibold text-blue-900 mb-4 border-b pb-4">
                  Similar Services
                </h2>
                <div className="space-y-4">
                  {similarServices.map((similarService) => (
                    <Link 
                      key={similarService.id} 
                      href={`/tradespeople/${similarService.slug}`}
                      className="block group"
                    >
                      <div className="flex items-start gap-3">
                        {similarService.imageUrls && similarService.imageUrls.length > 0 && (
                          <img
                            src={similarService.imageUrls[0]}
                            alt={similarService.title}
                            className="w-20 h-16 md:w-24 md:h-20 object-cover rounded-lg shrink-0"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base font-semibold text-blue-900 group-hover:text-blue-700 truncate">
                            {similarService.title}
                          </h3>
                          {similarService.rating && (
                            <div className="flex items-center gap-1 text-sm mt-1">
                              <Star size={14} className="text-orange-500" />
                              <span>{similarService.rating}</span>
                              {similarService.reviewCount && (
                                <span className="text-gray-500">({similarService.reviewCount})</span>
                              )}
                            </div>
                          )}
                          <div className="text-lg font-bold text-blue-900 mt-1">
                            {similarService.priceString || (similarService.price && `₦${formatPrice(similarService.price)}`)}
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
                <li>• Verify provider credentials before hiring</li>
                <li>• Agree on scope and price before work begins</li>
                <li>• Never pay full amount upfront</li>
                <li>• Get a written agreement/receipt</li>
                <li>• Report suspicious behavior</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}