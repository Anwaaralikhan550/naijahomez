import React from 'react';
import Link from 'next/link';
import { MapPin, Star, Tag, Clock } from 'lucide-react';
const FeaturedSections = () => {
  const featuredMarketplace = [
    {
      id: 1,
      title: 'MacBook Pro M2',
      price: '₦850,000',
      condition: 'Like New',
      location: 'Victoria Island',
      posted: '1 day ago',
      image: '/api/placeholder/400/300',
      category: 'Electronics'
    },
    {
      id: 2,
      title: 'Modern L-Shaped Sofa',
      price: '₦250,000',
      condition: 'New',
      location: 'Lekki Phase 1',
      posted: '3 days ago',
      image: '/api/placeholder/400/300',
      category: 'Furniture'
    },
    {
      id: 3,
      title: 'Samsung 65" QLED TV',
      price: '₦450,000',
      condition: 'New',
      location: 'Ikoyi',
      posted: '2 days ago',
      image: '/api/placeholder/400/300',
      category: 'Electronics'
    },
    {
      id: 4,
      title: 'Toyota Camry 2022',
      price: '₦15,000,000',
      condition: 'Used',
      location: 'Ajah',
      posted: '5 days ago',
      image: '/api/placeholder/400/300',
      category: 'Vehicles'
    }
  ];

  const featuredServices = [
    {
      id: 1,
      title: 'Professional Photography',
      provider: 'David Studios',
      rating: 4.9,
      reviewCount: 156,
      location: 'Lekki',
      category: 'Photography',
      image: '/api/placeholder/400/300'
    },
    {
      id: 2,
      title: 'Expert Home Cleaning',
      provider: 'CleanPro Services',
      rating: 4.8,
      reviewCount: 203,
      location: 'Victoria Island',
      category: 'Cleaning',
      image: '/api/placeholder/400/300'
    },
    {
      id: 3,
      title: 'Mobile Car Wash',
      provider: 'AutoSpa Nigeria',
      rating: 4.7,
      reviewCount: 89,
      location: 'Ikoyi',
      category: 'Automotive',
      image: '/api/placeholder/400/300'
    },
    {
      id: 4,
      title: 'AC Repair & Installation',
      provider: 'CoolTech Solutions',
      rating: 4.9,
      reviewCount: 167,
      location: 'Lagos Mainland',
      category: 'Maintenance',
      image: '/api/placeholder/400/300'
    }
  ];

  const renderMarketplaceSection = () => (
    <div className="bg-white py-16">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between items-center mb-12">
          <h2 className="text-3xl font-bold text-blue-900">
            Featured in Marketplace
          </h2>
          <Link 
            href="/marketplace" 
            className="text-orange-500 hover:text-orange-600 transition-colors flex items-center gap-2"
          >
            View All Items
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>
        </div>

        <div className="grid md:grid-cols-4 gap-6">
          {featuredMarketplace.map((item) => (
            <Link 
              key={item.id}
              href={`/marketplace/${item.id}`}
              className="block group"
            >
              <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow">
                <div className="relative">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-48 object-cover"
                    loading="lazy"
                  />
                  <span className="absolute top-2 right-2 bg-orange-100 text-orange-600 px-2 py-1 rounded-full text-sm">
                    {item.condition}
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-blue-900 mb-2 group-hover:text-blue-700">
                    {item.title}
                  </h3>
                  <div className="text-xl font-bold text-blue-900 mb-3">
                    {item.price}
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center">
                      <Tag size={16} className="mr-1" />
                      <span>{item.category}</span>
                    </div>
                    <div className="flex items-center">
                      <MapPin size={16} className="mr-1" />
                      <span>{item.location}</span>
                    </div>
                    <div className="flex items-center">
                      <Clock size={16} className="mr-1" />
                      <span>{item.posted}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );

  const renderServicesSection = () => (
    <div className="bg-gray-50 py-16">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between items-center mb-12">
          <h2 className="text-3xl font-bold text-blue-900">
            Top Rated Services
          </h2>
          <Link 
            href="/services" 
            className="text-orange-500 hover:text-orange-600 transition-colors flex items-center gap-2"
          >
            View All Services
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>
        </div>

        <div className="grid md:grid-cols-4 gap-6">
          {featuredServices.map((service) => (
            <Link 
              key={service.id}
              href={`/services/${service.id}`}
              className="block group"
            >
              <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow">
                <div className="relative">
                  <img
                    src={service.image}
                    alt={service.title}
                    className="w-full h-48 object-cover"
                    loading="lazy"
                  />
                  <span className="absolute top-2 right-2 bg-blue-100 text-blue-600 px-2 py-1 rounded-full text-sm">
                    {service.category}
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-blue-900 mb-2 group-hover:text-blue-700">
                    {service.title}
                  </h3>
                  <p className="text-gray-600 mb-3">{service.provider}</p>
                  <div className="flex items-center gap-2 mb-3">
                    <Star size={16} className="text-orange-500" />
                    <span className="font-medium">{service.rating}</span>
                    <span className="text-gray-500">({service.reviewCount} reviews)</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <MapPin size={16} className="mr-1" />
                    <span>{service.location}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {renderMarketplaceSection()}
      {renderServicesSection()}
    </>
  );
};

export default FeaturedSections;