'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import HubLayout from '@/components/hub/HubLayout';
import { 
  Search, 
  Building2, 
  Users, 
  Plus,
  MapPin,
  Mail,
  Phone,
  CheckCircle,
  Clock,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authenticatedFetch } from '@/services/api';
import toast from 'react-hot-toast';

export default function HubCommunitiesPage() {
  const { user } = useAuth();
  const [communities, setCommunities] = useState([]);
  const [userCommunities, setUserCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [joinRequests, setJoinRequests] = useState([]);
  const [joiningCommunity, setJoiningCommunity] = useState(null);

  useEffect(() => {
    loadCommunities();
  }, [user]);

  const loadCommunities = async () => {
    try {
      setLoading(true);
      
      // Load user's communities (only if authenticated)
      if (user?.uid) {
        const userResponse = await authenticatedFetch(`/api/hub/communities?type=user&userId=${user.uid}`);
        if (userResponse.ok) {
          const userResult = await userResponse.json();
          setUserCommunities(userResult.communities || []);
        }

        // Load user's join requests
        const requestsResponse = await authenticatedFetch(`/api/hub/join-requests?userId=${user.uid}`);
        if (requestsResponse.ok) {
          const requestsResult = await requestsResponse.json();
          setJoinRequests(requestsResult.requests || []);
        }
      }

      // Load all public communities (available for both authenticated and guest users)
      const publicResponse = await fetch('/api/hub/communities?type=public');
      if (publicResponse.ok) {
        const publicResult = await publicResponse.json();
        setCommunities(publicResult.communities || []);
      }
    } catch (error) {
      console.error('Error loading communities:', error);
      toast.error('Failed to load communities');
    } finally {
      setLoading(false);
    }
  };

  const searchCommunities = async () => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      const response = await fetch(`/api/hub/communities?search=${encodeURIComponent(searchTerm)}`);
      const result = await response.json();
      
      if (response.ok) {
        setSearchResults(result.communities || []);
      } else {
        throw new Error(result.error || 'Failed to search communities');
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error(`❌ ${error.message}`);
    } finally {
      setSearching(false);
    }
  };

  const joinCommunity = async (communityId, communityName) => {
    try {
      setJoiningCommunity(communityId);
      const response = await authenticatedFetch('/api/hub/join-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          userName: user.displayName || user.email,
          userEmail: user.email,
          communityId,
          communityName,
          message: 'Join request from communities page',
          phoneNumber: '',
          unitNumber: ''
        })
      });

      if (response.ok) {
        toast.success('✅ Join request sent successfully!');
        loadCommunities(); // Refresh the lists
      } else {
        const result = await response.json();
        throw new Error(result.error || 'Failed to send join request');
      }
    } catch (error) {
      toast.error(`❌ ${error.message}`);
    } finally {
      setJoiningCommunity(null);
    }
  };

  // Helper function to get button state for a community
  const getJoinButtonState = (communityId) => {
    // Check if user is already a member
    const isMember = userCommunities.some(c => c.id === communityId);
    if (isMember) return 'joined';

    // Check join request status
    const joinRequest = joinRequests.find(r => r.communityId === communityId);
    if (joinRequest) {
      if (joinRequest.status === 'pending') return 'requested';
      if (joinRequest.status === 'approved') return 'joined';
      // 'rejected' status falls through to allow re-joining
    }

    // Check if currently joining
    if (joiningCommunity === communityId) return 'joining';

    return 'join';
  };

  // Helper component for join button
  const JoinButton = ({ communityId, communityName, className = "" }) => {
    // If user is not authenticated, show sign in prompt
    if (!user) {
      return (
        <Link
          href="/login?returnUrl=/dashboard/community/communities"
          className={`px-4 py-2 rounded-lg transition text-sm flex items-center bg-gray-100 text-gray-700 hover:bg-gray-200 ${className}`}
        >
          <Plus className="w-3 h-3 mr-1" />
          Sign In to Join
        </Link>
      );
    }

    const state = getJoinButtonState(communityId);
    
    const buttonConfig = {
      join: {
        text: 'Join',
        className: 'bg-blue-600 text-white hover:bg-blue-700',
        disabled: false,
        onClick: () => joinCommunity(communityId, communityName),
        icon: <Plus className="w-3 h-3 mr-1" />
      },
      joined: {
        text: 'Joined',
        className: 'bg-green-100 text-green-800 cursor-default',
        disabled: true,
        onClick: () => {},
        icon: <CheckCircle className="w-3 h-3 mr-1" />
      },
      requested: {
        text: 'Requested to Join',
        className: 'bg-yellow-100 text-yellow-800 cursor-default',
        disabled: true,
        onClick: () => {},
        icon: <Clock className="w-3 h-3 mr-1" />
      },
      joining: {
        text: 'Joining...',
        className: 'bg-blue-400 text-white cursor-not-allowed',
        disabled: true,
        onClick: () => {},
        icon: <Clock className="w-3 h-3 mr-1 animate-spin" />
      }
    };

    const config = buttonConfig[state];
    
    return (
      <button
        onClick={config.onClick}
        disabled={config.disabled}
        className={`px-4 py-2 rounded-lg transition text-sm flex items-center ${config.className} ${className}`}
      >
        {config.icon}
        {config.text}
      </button>
    );
  };

  if (loading) {
    return (
      <HubLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </HubLayout>
    );
  }

  return (
    <HubLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Communities</h1>
          <p className="text-gray-600">
            {user 
              ? "Discover and join communities in your area" 
              : "Browse communities in your area. Sign in to join and access community features."
            }
          </p>
        </div>

        {/* Guest information banner */}
        {!user && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <Building2 className="w-5 h-5 text-blue-600 mt-0.5" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-900">Explore Communities</h3>
                <div className="mt-1 text-sm text-blue-700">
                  <p>You're browsing as a guest. Sign in to join communities, participate in discussions, and access all Hub features.</p>
                </div>
                <div className="mt-4 flex space-x-3">
                  <Link
                    href="/login?returnUrl=/dashboard/community/communities"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/register?returnUrl=/dashboard/community/communities"
                    className="bg-white text-blue-600 px-4 py-2 rounded-lg text-sm font-medium border border-blue-600 hover:bg-blue-50 transition"
                  >
                    Sign Up
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search communities by name or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchCommunities()}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={searchCommunities}
              disabled={searching || !searchTerm.trim()}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {searching ? 'Searching...' : 'Search'}
            </button>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Search Results</h3>
              <div className="grid gap-4">
                {searchResults.map((community) => (
                  <div key={community.id} className="border rounded-lg p-4 hover:shadow-md transition">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 flex items-center mb-2">
                          <Building2 className="w-4 h-4 mr-2 text-blue-600" />
                          {community.name}
                        </h4>
                        {community.address && (
                          <div className="flex items-center text-gray-600 text-sm mb-1">
                            <MapPin className="w-3 h-3 mr-1" />
                            {community.address}
                          </div>
                        )}
                        {community.memberCount && (
                          <div className="flex items-center text-gray-600 text-sm">
                            <Users className="w-3 h-3 mr-1" />
                            {community.memberCount} members
                          </div>
                        )}
                      </div>
                      <JoinButton
                        communityId={community.id}
                        communityName={community.name}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {searchTerm && searchResults.length === 0 && !searching && (
            <div className="text-center py-8 text-gray-500">
              <Building2 className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p>No communities found matching "{searchTerm}"</p>
            </div>
          )}
        </div>

        {/* Your Communities */}
        {userCommunities.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Communities</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {userCommunities.map((community) => (
                <Link
                  key={community.id}
                  href={`/dashboard/community/feed?communityId=${community.id}`}
                  className="group block"
                >
                  <div className="border rounded-lg p-4 hover:shadow-md hover:border-blue-300 transition-all duration-200 cursor-pointer">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                        {community.name}
                      </h3>
                      <div className="flex items-center">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          community.role === 'admin' 
                            ? 'bg-purple-100 text-purple-800'
                            : community.role === 'moderator'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {community.role}
                        </span>
                        <ArrowRight className="w-4 h-4 text-gray-400 ml-2 group-hover:text-blue-600 transition-colors" />
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 mb-2 flex items-center">
                      <Users className="w-3 h-3 mr-1" />
                      {community.memberCount} members
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {community.description}
                    </p>
                    <div className="mt-3 text-xs text-blue-600 group-hover:text-blue-700 font-medium">
                      View Community Feed →
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* All Communities */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Browse Communities</h2>
          {communities.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {communities.map((community) => (
                <div key={community.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium text-gray-900">{community.name}</h3>
                    <JoinButton
                      communityId={community.id}
                      communityName={community.name}
                      className="px-3 py-1"
                    />
                  </div>
                  {community.address && (
                    <div className="text-sm text-gray-600 mb-1">
                      <MapPin className="w-3 h-3 inline mr-1" />
                      {community.address}
                    </div>
                  )}
                  <div className="text-sm text-gray-600 mb-2">
                    <Users className="w-3 h-3 inline mr-1" />
                    {community.memberCount || 0} members
                  </div>
                  {community.description && (
                    <p className="text-sm text-gray-600">{community.description.substring(0, 100)}...</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No communities available</p>
            </div>
          )}
        </div>
      </div>
    </HubLayout>
  );
}
