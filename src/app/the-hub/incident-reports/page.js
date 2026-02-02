'use client';
import { useState, useEffect } from 'react';
import HubLayout from '@/components/hub/HubLayout';
import IncidentReporter from '@/components/hub/emergency/IncidentReporter';
import { useAuth } from '@/context/AuthContext';

export default function IncidentReportsPage() {
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
          <div className="p-2 rounded-full bg-red-100 text-red-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.864-.833-2.634 0l-5.898 6.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Incident Reporting System</h1>
        </div>
        
        {currentCommunity ? (
          <IncidentReporter communityId={currentCommunity} />
        ) : (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-600 mb-4">
              Please select a community to access incident reporting features.
            </p>
          </div>
        )}
      </div>
    </HubLayout>
  );
}