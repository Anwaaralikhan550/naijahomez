'use client';
import HubLayout from '@/components/hub/HubLayout';
import WaterScheduling from '@/components/hub/smart-services/WaterScheduling';
import { useAuth } from '@/context/AuthContext';
import { useState, useEffect } from 'react';

export default function WaterSchedulingPage() {
  const { user } = useAuth();
  const [currentCommunityId, setCurrentCommunityId] = useState(null);

  useEffect(() => {
    // Get current community from localStorage or API
    const stored = localStorage.getItem('hubCurrentCommunity');
    if (stored) {
      setCurrentCommunityId(stored);
    }
  }, []);

  if (!user) {
    return (
      <HubLayout>
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h1>
            <p className="text-gray-600">Please log in to access Water Scheduling.</p>
          </div>
        </div>
      </HubLayout>
    );
  }

  return (
    <HubLayout>
      <div className="max-w-6xl mx-auto p-6">
        {currentCommunityId ? (
          <WaterScheduling communityId={currentCommunityId} />
        ) : (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-600 mb-4">
              Please select a community to access water scheduling features.
            </p>
          </div>
        )}
      </div>
    </HubLayout>
  );
}