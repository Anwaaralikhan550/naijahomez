'use client';
import HubLayout from '@/components/hub/HubLayout';
import IssueReporting from '@/components/hub/IssueReporting';
import { useAuth } from '@/context/AuthContext';
import { useState, useEffect } from 'react';
import { authenticatedFetch } from '@/services/api';

export default function HubIssuesPage() {
  const { user } = useAuth();
  const [selectedCommunity, setSelectedCommunity] = useState(null);
  const [loading, setLoading] = useState(true);

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
          const communities = result.communities || [];
          // Auto-select first community if available
          if (communities.length > 0) {
            setSelectedCommunity(communities[0]);
          }
        }
      } catch (error) {
        console.error('Error loading communities:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUserCommunities();
  }, [user?.uid]);

  if (loading) {
    return (
      <HubLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </HubLayout>
    );
  }

  if (!selectedCommunity) {
    return (
      <HubLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Community Selected</h2>
          <p className="text-gray-600 mb-4">You need to join a community to report issues.</p>
          <a href="/dashboard/community/dashboard" className="text-blue-600 hover:underline">
            Return to Community Hub
          </a>
        </div>
      </HubLayout>
    );
  }

  return (
    <HubLayout>
      <IssueReporting communityId={selectedCommunity.id} />
    </HubLayout>
  );
}
