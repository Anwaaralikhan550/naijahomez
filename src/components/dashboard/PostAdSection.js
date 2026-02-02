'use client';
// components/dashboard/PostAdSection.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import apiService from '@/services/api';
import { Home, Package, Briefcase, Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'next/navigation';
import PropertyForm from './forms/PropertyForm';
import MarketplaceForm from './forms/MarketplaceForm';
import ServiceForm from './forms/ServiceForm';
import NoticeForm from './forms/NoticeForm';
import HousemateForm from './forms/HousemateForm';

export default function PostAdSection() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [adType, setAdType] = useState('');

  // Check URL parameters for pre-selected ad type
  useEffect(() => {
    const type = searchParams.get('type');
    if (type && ['property', 'marketplace', 'service', 'notice'].includes(type)) {
      setAdType(type);
    }
  }, [searchParams]);

  const handleSubmit = async (formData, images) => {
    try {
      if (!user) {
        toast.error('You must be logged in to post an ad');
        return;
      }
  
      // Determine collection name based on ad type
      const collectionName = 
        formData.type === 'property' ? 'properties' : 
        formData.type === 'marketplace' ? 'marketplace' : 
        formData.type === 'service' ? 'services' : 
        formData.type === 'notice' ? 'noticeboard' : null;
      
      if (!collectionName) {
        toast.error('Invalid ad type');
        return;
      }
  
      console.log("Submitting ad to collection:", collectionName);
      console.log("Form data:", formData);
      console.log("Images:", images);
  
      // Prepare submission data
      const submissionData = {
        ...formData,
        imageUrls: images.map(img => img.url),
        userId: user.uid,
        userEmail: user.email,
        userName: user.displayName || 'Anonymous',
        userPhotoURL: user.photoURL || null,
        status: 'active',
        collectionName
      };
  
      // Submit ad using apiService
      await apiService.createAd(submissionData);
      toast.success('Ad posted successfully! View it in My Ads section.');
      setAdType(''); // Reset to type selection
      
    } catch (error) {
      console.error('Submission error:', error);
      toast.error(`Failed to post ad: ${error.message}`);
    }
  };

  // Render ad type selection
  if (!adType) {
    return (
      <div className="grid md:grid-cols-4 gap-6">
        {[
          {
            type: 'property',
            title: 'List a Property',
            description: 'Sell or rent out your property',
            icon: Home
          },
          {
            type: 'marketplace',
            title: 'Sell an Item',
            description: 'List items in the marketplace',
            icon: Package
          },
          {
            type: 'service',
            title: 'Offer a Service',
            description: 'Promote your professional services',
            icon: Briefcase
          },
          {
            type: 'housemate',
            title: 'Find a Housemate',
            description: 'List a room or find a housemate',
            icon: Home
          },
          {
            type: 'notice',
            title: 'Post a Notice',
            description: 'Share events, announcements or opportunities',
            icon: Bell
          }
        ].map((option) => (
          <button
            key={option.type}
            onClick={() => setAdType(option.type)}
            className="p-6 bg-white rounded-xl shadow-md hover:shadow-lg transition-all text-left"
          >
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <option.icon className="text-blue-500" size={24} />
            </div>
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              {option.title}
            </h3>
            <p className="text-gray-600">
              {option.description}
            </p>
          </button>
        ))}
      </div>
    );
  }

  // Render appropriate form based on type
  return (
    <div>
      {adType === 'property' && (
        <PropertyForm onSubmit={handleSubmit} onCancel={() => setAdType('')} />
      )}
      {adType === 'marketplace' && (
        <MarketplaceForm onSubmit={handleSubmit} onCancel={() => setAdType('')} />
      )}
      {adType === 'service' && (
        <ServiceForm onSubmit={handleSubmit} onCancel={() => setAdType('')} />
      )}
      {adType === 'housemate' && (
        <HousemateForm onSubmit={handleSubmit} onCancel={() => setAdType('')} />
      )}
      {adType === 'notice' && (
        <NoticeForm onSubmit={handleSubmit} onCancel={() => setAdType('')} />
      )}
    </div>
  );
}