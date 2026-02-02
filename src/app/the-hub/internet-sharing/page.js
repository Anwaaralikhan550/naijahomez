'use client';
import { useState, useEffect } from 'react';
import HubLayout from '@/components/hub/HubLayout';
import InternetSharing from '@/components/hub/smart-services/InternetSharing';
import { useAuth } from '@/context/AuthContext';

export default function InternetSharingPage() {
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
          <div className="p-2 rounded-full bg-blue-100 text-blue-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Internet Cost Sharing</h1>
        </div>
        
        {currentCommunity ? (
          <InternetSharing communityId={currentCommunity} />
        ) : (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-600 mb-4">
              Please select a community to access internet sharing features.
            </p>
          </div>
        )}
      </div>
    </HubLayout>
  );
}