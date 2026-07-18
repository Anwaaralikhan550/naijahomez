'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { MapPin, Clock, Bell, Loader2 } from 'lucide-react';
import apiService from '@/services/api';

const FeaturedNotices = () => {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadFeaturedNotices = async () => {
      try {
        setLoading(true);
        
        // Use API service to get recent notices
        const response = await apiService.getNotices({ 
          limit: 4, 
          sortBy: 'createdAt', 
          sortOrder: 'desc' 
        });
        
        if (response.success) {
          const validNotices = (response.data || [])
            .map(notice => ({
              ...notice,
              slug: notice.slug || `${notice.id}`
            }))
            .filter(notice => notice.imageUrls && notice.imageUrls.length > 0);
          
          setNotices(validNotices);
        } else {
          throw new Error(response.error || 'Failed to load notices');
        }
      } catch (error) {
        console.error('Error loading featured notices:', error);
        setError('Failed to load featured notices');
      } finally {
        setLoading(false);
      }
    };

    loadFeaturedNotices();
  }, []);

  if (loading) {
    return (
      <div className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-blue-900 mb-12">
            Community Noticeboard
          </h2>
          <div className="grid md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((_, index) => (
              <div key={index} className="animate-pulse">
                <div className="bg-gray-200 h-48 rounded-t-xl"></div>
                <div className="bg-white p-4 rounded-b-xl">
                  <div className="h-4 bg-gray-200 mb-3 w-3/4"></div>
                  <div className="h-4 bg-gray-200 mb-3 w-1/2"></div>
                  <div className="h-4 bg-gray-200 w-1/4"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-blue-900 mb-12">
            Community Noticeboard
          </h2>
          <div className="text-center py-12 bg-red-50 rounded-lg">
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (notices.length === 0) {
    return null;
  }

  // Helper function to format notice types
  const formatNoticeType = (type) => {
    const types = {
      'announcement': 'Announcement',
      'event': 'Event',
      'job': 'Job Opportunity',
      'lost_found': 'Lost & Found',
      'community': 'Community Notice',
      'other': 'Notice'
    };
    
    return types[type] || 'Notice';
  };

  return (
    <div className="py-16 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between items-center mb-12">
          <h2 className="text-3xl font-bold text-blue-900">
            Community Noticeboard
          </h2>
          <Link 
            href="/noticeboard" 
            className="text-orange-500 hover:text-orange-600 transition-colors flex items-center gap-2"
          >
            View All Notices
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>
        </div>

        <div className="grid md:grid-cols-4 gap-6">
          {notices.map((notice) => (
            <Link 
              key={notice.id}
              href={`/noticeboard/${notice.slug}`}
              className="block group h-full"
            >
              <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow h-full flex flex-col">
                <div className="relative">
                  <img
                    src={notice.imageUrls[0]}
                    alt={notice.title}
                    className="w-full h-48 object-cover"
                    loading="lazy"
                  />
                  <span className="absolute top-2 right-2 bg-blue-500 text-white px-2 py-1 rounded-full text-sm">
                    {formatNoticeType(notice.noticeType)}
                  </span>
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <h3 className="text-lg font-semibold text-blue-900 mb-2 group-hover:text-blue-700 line-clamp-2 min-h-[3.5rem]">
                    {notice.title}
                  </h3>
                  
                  <div className="flex items-center justify-between mb-3 mt-auto">
                    <div className="flex items-center text-gray-600 text-sm">
                      <MapPin size={16} className="mr-1" />
                      <span className="line-clamp-1 max-w-[120px]">{notice.location}</span>
                    </div>
                    <div className="flex items-center text-gray-600 text-sm">
                      <Clock size={16} className="mr-1" />
                      <span>
                        {notice.createdAt?.seconds
                          ? new Date(notice.createdAt.seconds * 1000).toLocaleDateString()
                          : notice.createdAt?.toDate
                            ? new Date(notice.createdAt.toDate()).toLocaleDateString()
                            : notice.createdAt
                              ? new Date(notice.createdAt).toLocaleDateString()
                              : ''}
                      </span>
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
};

export default FeaturedNotices;
