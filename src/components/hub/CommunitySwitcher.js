'use client';
import React, { useState, useEffect } from 'react';
import { 
  ChevronDown, 
  Building2, 
  CheckCircle,
  Users,
  MapPin,
  X
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authenticatedFetch } from '@/services/api';
import toast from 'react-hot-toast';

const CommunitySwitcher = ({ currentCommunity, onCommunityChange, onClose }) => {
  const { user } = useAuth();
  const [userCommunities, setUserCommunities] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadUserCommunities();
    }
  }, [user]);

  const loadUserCommunities = async () => {
    try {
      setLoading(true);
      // Use API endpoint instead of direct import
      const response = await authenticatedFetch(`/api/hub/communities?type=user&userId=${user.uid}`);

      if (!response.ok) {
        throw new Error('Failed to fetch communities');
      }
      
      const data = await response.json();
      const communities = data.communities || [];
      
      // Transform to the expected format
      const communitiesWithDetails = communities.map(community => ({
        id: community.id,
        communityId: community.id,
        role: community.role,
        joinedAt: community.joinedAt,
        community: {
          id: community.id,
          name: community.name,
          address: community.location,
          memberCount: community.memberCount
        }
      }));
      
      setUserCommunities(communitiesWithDetails);
    } catch (error) {
      console.error('Error loading user communities:', error);
      toast.error('Failed to load your communities');
    } finally {
      setLoading(false);
    }
  };

  const handleCommunitySelect = (membership) => {
    if (membership.communityId === currentCommunity) {
      return; // Already selected
    }

    onCommunityChange({
      communityId: membership.communityId,
      role: membership.role,
      membership: membership
    });

    toast.success(`✅ Switched to ${membership.community.name}`, {
      duration: 3000,
      position: 'top-center',
      style: {
        background: '#10B981',
        color: 'white',
        fontWeight: 'bold',
        padding: '16px',
        borderRadius: '8px'
      }
    });

    onClose();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl p-6">
          <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
          <p className="text-center mt-4 text-gray-600">Loading your communities...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Switch Community</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {userCommunities.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>You're not a member of any communities</p>
              <p className="text-sm mt-1">Join a community to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {userCommunities.map((membership) => (
                <div
                  key={membership.id}
                  onClick={() => handleCommunitySelect(membership)}
                  className={`border rounded-lg p-4 cursor-pointer transition hover:shadow-md ${
                    membership.communityId === currentCommunity
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <Building2 className="w-5 h-5 mr-2 text-blue-600" />
                        <h3 className="font-medium text-gray-900">
                          {membership.community.name}
                        </h3>
                        {membership.communityId === currentCommunity && (
                          <CheckCircle className="w-5 h-5 ml-2 text-blue-600" />
                        )}
                      </div>
                      
                      <div className="space-y-1 text-sm text-gray-600">
                        <div className="flex items-center">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            membership.role === 'admin' 
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {membership.role}
                          </span>
                        </div>
                        
                        {membership.community.address && (
                          <div className="flex items-center mt-2">
                            <MapPin className="w-4 h-4 mr-1" />
                            <span className="text-xs">{membership.community.address}</span>
                          </div>
                        )}
                        
                        {membership.unitNumber && (
                          <div className="text-xs">
                            Unit: {membership.unitNumber}
                          </div>
                        )}
                        
                        <div className="text-xs text-gray-500">
                          Joined: {membership.joinedAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 pt-6 border-t">
            <p className="text-xs text-gray-500 text-center">
              Contact your community admin to join additional communities
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommunitySwitcher;