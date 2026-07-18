'use client';
import HubLayout from '@/components/hub/HubLayout';
import CommunitySocialFeed from '@/components/hub/CommunitySocialFeed';
import { useAuth } from '@/context/AuthContext';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { authenticatedFetch } from '@/services/api';

function HubFeedContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [selectedCommunity, setSelectedCommunity] = useState(null);
  const [userCommunities, setUserCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const targetCommunityId = searchParams.get('communityId');

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const loadUserCommunities = async () => {
      try {
        const response = await authenticatedFetch(`/api/hub/communities?type=user&userId=${user.uid}`);
        if (response.ok) {
          const result = await response.json();
          setUserCommunities(result.communities || []);
          
          // Select community based on URL parameter or auto-select first
          if (result.communities && result.communities.length > 0) {
            let communityToSelect = result.communities[0]; // Default to first
            
            // If targetCommunityId is provided, try to find and select that community
            if (targetCommunityId) {
              const targetCommunity = result.communities.find(c => c.id === targetCommunityId);
              if (targetCommunity) {
                communityToSelect = targetCommunity;
                console.log('Selected community from URL:', targetCommunity.name);
              } else {
                console.warn('Community not found or user not a member:', targetCommunityId);
              }
            }
            
            setSelectedCommunity(communityToSelect);
          }
        }
      } catch (error) {
        console.error('Error loading communities:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUserCommunities();
  }, [user?.uid, targetCommunityId]);

  if (loading) {
    return (
      <HubLayout communityId={targetCommunityId}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </HubLayout>
    );
  }

  if (userCommunities.length === 0) {
    return (
      <HubLayout communityId={targetCommunityId}>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Communities Found</h2>
          <p className="text-gray-600 mb-4">You need to join a community to view the social feed.</p>
          <a href="/dashboard/community" className="text-blue-600 hover:underline">
            Return to Community Hub
          </a>
        </div>
      </HubLayout>
    );
  }

  return (
    <HubLayout communityId={selectedCommunity?.id}>
      <div className="space-y-6">
        {/* Community Selector */}
        {userCommunities.length > 1 && (
          <div className="bg-white rounded-lg shadow p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Community
            </label>
            <select
              value={selectedCommunity?.id || ''}
              onChange={(e) => {
                const community = userCommunities.find(c => c.id === e.target.value);
                setSelectedCommunity(community);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {userCommunities.map(community => (
                <option key={community.id} value={community.id}>
                  {community.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Social Feed */}
        {selectedCommunity && (
          <CommunitySocialFeed communityId={selectedCommunity.id} />
        )}
      </div>
    </HubLayout>
  );
}

export default function HubFeedPage() {
  return (
    <Suspense fallback={
      <HubLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </HubLayout>
    }>
      <HubFeedContent />
    </Suspense>
  );
}
