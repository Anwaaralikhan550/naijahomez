'use client';
import React, { useState, useEffect } from 'react';
import { Shield, Users, Clock, Trophy, Search, HeartHandshake } from 'lucide-react';
import apiService from '@/services/api';

const WhyChooseSection = () => {
  const [counts, setCounts] = useState({
    marketplace: 0,
    properties: 0,
    services: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCollectionCounts = async () => {
      try {
        const statsRes = await apiService.getPublicStats();
        const stats = statsRes?.data || {};
        setCounts({
          marketplace: Number(stats.marketplace || 0),
          properties: Number(stats.properties || 0),
          services: Number(stats.services || 0)
        });
      } catch (error) {
        console.error('Error fetching collection counts:', error);
        setCounts({
          marketplace: 0,
          properties: 0,
          services: 0
        });
      } finally {
        setLoading(false);
      }
    };

    fetchCollectionCounts();
  }, []);

  const formatCount = (count) => Number(count || 0).toLocaleString();

  const features = [
    {
      icon: Search,
      title: 'Wide Selection',
      description: 'Browse through thousands of verified listings across properties, marketplace items, and professional services.',
      color: 'text-blue-500',
      bgColor: 'bg-blue-50'
    },
    {
      icon: Shield,
      title: 'Trusted Platform',
      description: 'Every listing and service provider is verified to ensure a safe and reliable experience for our users.',
      color: 'text-green-500',
      bgColor: 'bg-green-50'
    },
    {
      icon: Clock,
      title: 'Real-Time Updates',
      description: 'Get instant notifications about new listings, price changes, and responses to your inquiries.',
      color: 'text-purple-500',
      bgColor: 'bg-purple-50'
    },
    {
      icon: Users,
      title: 'Active Community',
      description: 'Join our growing community of buyers, sellers, and service providers from all around Nigeria.',
      color: 'text-orange-500',
      bgColor: 'bg-orange-50'
    },
    {
      icon: HeartHandshake,
      title: 'Dedicated Support',
      description: '24/7 customer support to help you with any questions or concerns about your transactions.',
      color: 'text-pink-500',
      bgColor: 'bg-pink-50'
    },
    {
      icon: Trophy,
      title: 'Best Deals',
      description: 'Find competitive prices and great deals on properties, items, and services all in one place.',
      color: 'text-blue-500',
      bgColor: 'bg-blue-50'
    }
  ];

  return (
    <div className="py-20 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-4xl font-bold text-blue-900 mb-6">
            Why Choose Nijahomzs
          </h2>
          <p className="text-gray-600 text-lg">
            We provide a seamless experience for buying, selling, and connecting with service providers all in one place.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="relative"
            >
              <div className={`
                relative
                z-10
                p-8
                bg-white
                rounded-xl
                shadow-lg
                ${feature.bgColor}
                border border-gray-100
              `}>
                <div className={`
                  w-16
                  h-16
                  rounded-lg
                  ${feature.color}
                  bg-white
                  shadow-md
                  flex
                  items-center
                  justify-center
                  mb-6
                `}>
                  <feature.icon size={32} />
                </div>
                
                <h3 className="text-xl font-bold text-blue-900 mb-4">
                  {feature.title}
                </h3>
                
                <p className="text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>

              {/* Decorative background pattern */}
              <div className={`
                absolute
                top-4
                left-4
                w-full
                h-full
                rounded-xl
                ${feature.bgColor}
                opacity-50
                -z-10
              `} />
            </div>
          ))}
        </div>

        {/* Stats Section with dynamic data from Firestore */}
        <div className="mt-20 grid md:grid-cols-3 gap-8">
          {[
            { label: 'Items Listed', value: counts.marketplace, loading },
            { label: 'Properties Listed', value: counts.properties, loading },
            { label: 'Service Providers', value: counts.services, loading }
          ].map((stat, index) => (
            <div 
              key={index} 
              className="text-center p-6 md:p-4 bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow"
            >
              <div className="text-3xl font-bold text-blue-900 mb-2">
                {stat.loading ? (
                  <div className="animate-pulse h-8 w-20 bg-gray-200 mx-auto rounded"></div>
                ) : (
                  formatCount(stat.value)
                )}
              </div>
              <div className="text-gray-600">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WhyChooseSection;
