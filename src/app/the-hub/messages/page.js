'use client';
import React, { useState, useEffect } from 'react';
import HubLayout from '@/components/hub/HubLayout';
import PrivateMessages from '@/components/hub/PrivateMessages';
import { useAuth } from '@/context/AuthContext';

export default function HubMessagesPage() {
  const { user } = useAuth();
  const [currentCommunity, setCurrentCommunity] = useState(null);

  useEffect(() => {
    // Get current community from localStorage (set by HubLayout)
    const savedCommunityId = localStorage.getItem('hubCurrentCommunity');
    if (savedCommunityId) {
      setCurrentCommunity({ id: savedCommunityId });
    }
  }, []);

  return (
    <HubLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
          <p className="text-gray-600">
            {currentCommunity 
              ? "Send private messages to community members" 
              : "Please select a community to start messaging"
            }
          </p>
        </div>

        {currentCommunity ? (
          <PrivateMessages communityId={currentCommunity.id} />
        ) : (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="text-gray-500">
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Community Selected</h3>
              <p>Please select a community from the sidebar to access private messaging.</p>
            </div>
          </div>
        )}
      </div>
    </HubLayout>
  );
}