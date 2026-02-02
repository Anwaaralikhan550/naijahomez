'use client';
import HubLayout from '@/components/hub/HubLayout';
import EmergencyContacts from '@/components/hub/emergency/EmergencyContacts';
import { useAuth } from '@/context/AuthContext';
import { useState, useEffect } from 'react';

export default function EmergencyContactsPage() {
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
            <p className="text-gray-600">Please log in to access Emergency Contacts.</p>
          </div>
        </div>
      </HubLayout>
    );
  }

  return (
    <HubLayout>
      <div className="max-w-6xl mx-auto p-6">
        <EmergencyContacts communityId={currentCommunityId} />
      </div>
    </HubLayout>
  );
}