'use client';
import HubLayout from '@/components/hub/HubLayout';
import GeneratorNetwork from '@/components/hub/smart-services/GeneratorNetwork';
import { useAuth } from '@/context/AuthContext';
import { useState, useEffect } from 'react';

export default function GeneratorNetworkPage() {
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
            <p className="text-gray-600">Please log in to access the Generator Network.</p>
          </div>
        </div>
      </HubLayout>
    );
  }

  return (
    <HubLayout>
      <div className="max-w-6xl mx-auto p-6">
        {currentCommunityId ? (
          <GeneratorNetwork communityId={currentCommunityId} />
        ) : (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-600 mb-4">
              Please select a community to access generator network features.
            </p>
          </div>
        )}
      </div>
    </HubLayout>
  );
}