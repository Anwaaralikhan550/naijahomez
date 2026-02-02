'use client';
import { useState, useEffect } from 'react';
import HubLayout from '@/components/hub/HubLayout';
import CommunityWatch from '@/components/hub/emergency/CommunityWatch';
import { useAuth } from '@/context/AuthContext';

export default function CommunityWatchPage() {
  const { user } = useAuth();
  const [currentCommunity, setCurrentCommunity] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem('hubCurrentCommunity');
    if (stored) {
      setCurrentCommunity(stored);
    }
  }, []);

  return (
    <HubLayout>
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 rounded-full bg-indigo-100 text-indigo-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Community Watch Program</h1>
        </div>
        
        {currentCommunity ? (
          <CommunityWatch communityId={currentCommunity} />
        ) : (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-600 mb-4">
              Please select a community to access community watch features.
            </p>
          </div>
        )}
      </div>
    </HubLayout>
  );
}