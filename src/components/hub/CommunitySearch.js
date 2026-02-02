'use client';
import React, { useState, useEffect } from 'react';
import {
  Search,
  MapPin,
  Users,
  ArrowRight,
  Building2,
  Mail,
  Phone,
  Globe,
  X,
  Plus,
  CheckCircle,
  Clock
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authenticatedFetch } from '@/services/api';
import toast from 'react-hot-toast';

const CommunitySearch = ({ onClose, onSelect }) => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCommunity, setSelectedCommunity] = useState(null);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [joinData, setJoinData] = useState({
    message: '',
    phoneNumber: '',
    unitNumber: ''
  });
  // Join request state tracking
  const [joinRequests, setJoinRequests] = useState([]);
  const [userCommunities, setUserCommunities] = useState([]);
  const [joiningCommunity, setJoiningCommunity] = useState(null);

  // Load user's join requests and communities on mount
  useEffect(() => {
    if (user?.uid) {
      loadUserJoinData();
    }
  }, [user]);

  const loadUserJoinData = async () => {
    try {
      // Load user's join requests
      const requestsResponse = await authenticatedFetch(`/api/hub/join-requests?userId=${user.uid}`);
      if (requestsResponse.ok) {
        const requestsResult = await requestsResponse.json();
        setJoinRequests(requestsResult.requests || []);
      }

      // Load user's communities
      const communitiesResponse = await authenticatedFetch(`/api/hub/communities?type=user&userId=${user.uid}`);
      if (communitiesResponse.ok) {
        const communitiesResult = await communitiesResponse.json();
        setUserCommunities(communitiesResult.communities || []);
      }
    } catch (error) {
      console.error('Error loading user join data:', error);
    }
  };

  // Get button state for a community (matches main page logic)
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

  const searchCommunities = async () => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      const response = await authenticatedFetch(`/api/hub/communities?search=${encodeURIComponent(searchTerm)}`);
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
      setLoading(false);
    }
  };

  const handleJoinRequest = async (community) => {
    setJoiningCommunity(community.id);
    setSelectedCommunity(community);
    setShowJoinForm(true);
    setJoiningCommunity(null);
  };

  const submitJoinRequest = async (e) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Please sign in to join a community');
      return;
    }

    try {
      setLoading(true);
      const response = await authenticatedFetch('/api/hub/join-requests', {
        method: 'POST',
        body: JSON.stringify({
          userId: user.uid,
          userName: user.displayName || user.email,
          userEmail: user.email,
          communityId: selectedCommunity.id,
          communityName: selectedCommunity.name,
          message: joinData.message,
          phoneNumber: joinData.phoneNumber,
          unitNumber: joinData.unitNumber
        })
      });

      const result = await response.json();

      if (response.ok) {
        toast.success('✅ Join request sent successfully!', {
          duration: 4000,
          position: 'top-center',
          style: {
            background: '#10B981',
            color: 'white',
            fontWeight: 'bold',
            padding: '16px',
            borderRadius: '8px'
          }
        });

        setShowJoinForm(false);
        setSelectedCommunity(null);
        setJoinData({ message: '', phoneNumber: '', unitNumber: '' });
        // Reload join requests to update button states
        loadUserJoinData();
      } else {
        throw new Error(result.error || 'Failed to send join request');
      }
    } catch (error) {
      toast.error(`❌ ${error.message}`, {
        duration: 4000,
        position: 'top-center',
        style: {
          background: '#EF4444',
          color: 'white',
          fontWeight: 'bold',
          padding: '16px',
          borderRadius: '8px'
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setJoinData({
      ...joinData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Find Your Community</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {!showJoinForm ? (
            <>
              {/* Search Interface */}
              <div className="mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search by community name, location, or estate..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && searchCommunities()}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={searchCommunities}
                  disabled={loading || !searchTerm.trim()}
                  className="mt-3 w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {loading ? 'Searching...' : 'Search Communities'}
                </button>
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900">Search Results</h3>
                  {searchResults.map((community) => (
                    <div key={community.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                            <Building2 className="w-5 h-5 mr-2 text-blue-600" />
                            {community.name}
                          </h4>
                          
                          {community.address && (
                            <div className="flex items-center text-gray-600 mb-2">
                              <MapPin className="w-4 h-4 mr-2" />
                              <span className="text-sm">{community.address}</span>
                            </div>
                          )}
                          
                          {community.memberCount && (
                            <div className="flex items-center text-gray-600 mb-2">
                              <Users className="w-4 h-4 mr-2" />
                              <span className="text-sm">{community.memberCount} members</span>
                            </div>
                          )}

                          {community.description && (
                            <p className="text-gray-600 text-sm mb-3">{community.description}</p>
                          )}

                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            {community.contactEmail && (
                              <div className="flex items-center">
                                <Mail className="w-3 h-3 mr-1" />
                                {community.contactEmail}
                              </div>
                            )}
                            {community.contactPhone && (
                              <div className="flex items-center">
                                <Phone className="w-3 h-3 mr-1" />
                                {community.contactPhone}
                              </div>
                            )}
                          </div>
                        </div>

                        {onSelect ? (
                          <button
                            onClick={() => onSelect(community)}
                            className="ml-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center text-sm"
                          >
                            Select
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </button>
                        ) : (
                          (() => {
                            const state = getJoinButtonState(community.id);
                            const buttonConfig = {
                              join: {
                                text: 'Request to Join',
                                className: 'bg-green-600 text-white hover:bg-green-700',
                                disabled: false,
                                icon: <Plus className="w-4 h-4 mr-1" />
                              },
                              joined: {
                                text: 'Joined',
                                className: 'bg-green-100 text-green-800 cursor-default',
                                disabled: true,
                                icon: <CheckCircle className="w-4 h-4 mr-1" />
                              },
                              requested: {
                                text: 'Requested',
                                className: 'bg-yellow-100 text-yellow-800 cursor-default',
                                disabled: true,
                                icon: <Clock className="w-4 h-4 mr-1" />
                              },
                              joining: {
                                text: 'Joining...',
                                className: 'bg-green-400 text-white cursor-not-allowed',
                                disabled: true,
                                icon: <Clock className="w-4 h-4 mr-1 animate-spin" />
                              }
                            };
                            const config = buttonConfig[state];
                            return (
                              <button
                                onClick={() => state === 'join' && handleJoinRequest(community)}
                                disabled={config.disabled}
                                className={`ml-4 px-4 py-2 rounded-lg transition flex items-center text-sm ${config.className}`}
                              >
                                {config.icon}
                                {config.text}
                              </button>
                            );
                          })()
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {searchTerm && searchResults.length === 0 && !loading && (
                <div className="text-center py-8 text-gray-500">
                  <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No communities found matching "{searchTerm}"</p>
                  <p className="text-sm mt-1">Try searching with different keywords</p>
                </div>
              )}
            </>
          ) : (
            /* Join Request Form */
            <div>
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Request to Join: {selectedCommunity?.name}
                </h3>
                <p className="text-gray-600 text-sm">
                  Fill out the form below and an admin will review your request.
                </p>
              </div>

              <form onSubmit={submitJoinRequest} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit/Apartment Number
                  </label>
                  <input
                    type="text"
                    name="unitNumber"
                    value={joinData.unitNumber}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Apt 5B, House 23"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    name="phoneNumber"
                    value={joinData.phoneNumber}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="+234..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Message to Admin (Optional)
                  </label>
                  <textarea
                    name="message"
                    value={joinData.message}
                    onChange={handleInputChange}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Introduce yourself or provide additional information..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowJoinForm(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 transition"
                  >
                    {loading ? 'Sending...' : 'Send Request'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommunitySearch;