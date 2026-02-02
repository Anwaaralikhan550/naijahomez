'use client';
import { useState, useEffect } from 'react';
import HubLayout from '@/components/hub/HubLayout';
import SecurityCoordination from '@/components/hub/smart-services/SecurityCoordination';
import { useAuth } from '@/context/AuthContext';

export default function SecurityCoordinationPage() {
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
          <div className="p-2 rounded-full bg-purple-100 text-purple-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Security Guard Coordination</h1>
        </div>
        
        {currentCommunity ? (
          <SecurityCoordination communityId={currentCommunity} />
        ) : (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-600 mb-4">
              Please select a community to access security coordination features.
            </p>
          </div>
        )}
      </div>
    </HubLayout>
  );
}