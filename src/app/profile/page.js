'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { User, Mail, Phone, MapPin, Calendar, Edit2, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [stats, setStats] = useState({
    activeListings: 0,
    communitiesJoined: 0,
    messagesSent: 0
  });
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    phoneNumber: '',
    location: '',
    bio: ''
  });

  useEffect(() => {
    if (!user) {
      router.push('/login?redirect=%2Fprofile');
      return;
    }

    // Initialize form data with user information
    setFormData({
      displayName: user.displayName || '',
      email: user.email || '',
      phoneNumber: user.phoneNumber || '',
      location: user.location || '',
      bio: user.bio || ''
    });

    // Load user stats
    loadUserStats();
  }, [user, router]);

  const loadUserStats = async () => {
    if (!user?.uid) return;

    try {
      setStatsLoading(true);
      
      // Fetch communities joined
      const communitiesResponse = await fetch(`/api/hub/communities?type=user&userId=${user.uid}`);
      let communitiesCount = 0;
      if (communitiesResponse.ok) {
        const communitiesData = await communitiesResponse.json();
        communitiesCount = communitiesData.communities?.length || 0;
      }

      // Fetch active listings (you'll need to implement this API endpoint)
      let activeListingsCount = 0;
      try {
        const listingsResponse = await fetch(`/api/user/listings?userId=${user.uid}`);
        if (listingsResponse.ok) {
          const listingsData = await listingsResponse.json();
          activeListingsCount = listingsData.count || 0;
        }
      } catch (error) {
        console.log('Listings API not implemented yet');
      }

      // Fetch messages sent (you'll need to implement this API endpoint)  
      let messagesSentCount = 0;
      try {
        const messagesResponse = await fetch(`/api/user/messages/count?userId=${user.uid}`);
        if (messagesResponse.ok) {
          const messagesData = await messagesResponse.json();
          messagesSentCount = messagesData.count || 0;
        }
      } catch (error) {
        console.log('Messages API not implemented yet');
      }

      setStats({
        activeListings: activeListingsCount,
        communitiesJoined: communitiesCount,
        messagesSent: messagesSentCount
      });
    } catch (error) {
      console.error('Error loading user stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      
      // Update the user profile
      const result = await updateProfile({
        displayName: formData.displayName,
        phoneNumber: formData.phoneNumber,
        location: formData.location,
        bio: formData.bio
      });

      if (result.error) {
        throw new Error(result.error);
      }

      toast.success('✅ Profile updated successfully!');
      setIsEditing(false);
    } catch (error) {
      console.error('Profile update error:', error);
      toast.error(`❌ Failed to update profile: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    // Reset form data to original user data
    setFormData({
      displayName: user.displayName || '',
      email: user.email || '',
      phoneNumber: user.phoneNumber || '',
      location: user.location || '',
      bio: user.bio || ''
    });
    setIsEditing(false);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center min-w-0">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-blue-100">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Profile photo'}
                    className="block h-full w-full object-cover object-center"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <User className="w-8 h-8 text-blue-600" />
                  </div>
                )}
              </div>
              <div className="ml-4 min-w-0 max-w-full">
                <h1 className="text-2xl font-bold text-gray-900 truncate max-w-full">
                  {user.displayName || 'User Profile'}
                </h1>
                <p className="text-gray-600 truncate max-w-full">Manage your account information</p>
              </div>
            </div>
            
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition w-full sm:w-auto"
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Edit Profile
              </button>
            ) : (
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <button
                  onClick={handleCancel}
                  className="flex items-center justify-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition flex-1 sm:flex-none"
                  disabled={loading}
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 flex-1 sm:flex-none"
                  disabled={loading}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Profile Form */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Personal Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Display Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="w-4 h-4 inline mr-1" />
                Display Name
              </label>
              {isEditing ? (
                <input
                  type="text"
                  name="displayName"
                  value={formData.displayName}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your display name"
                />
              ) : (
                <p className="px-3 py-2 bg-gray-50 rounded-lg text-gray-900 break-words max-w-full">
                  {formData.displayName || 'Not set'}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Mail className="w-4 h-4 inline mr-1" />
                Email Address
              </label>
              <p className="px-3 py-2 bg-gray-50 rounded-lg text-gray-500 break-all max-w-full">
                {formData.email}
                <span className="text-xs ml-2">(Cannot be changed)</span>
              </p>
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Phone className="w-4 h-4 inline mr-1" />
                Phone Number
              </label>
              {isEditing ? (
                <input
                  type="tel"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your phone number"
                />
              ) : (
                <p className="px-3 py-2 bg-gray-50 rounded-lg text-gray-900">
                  {formData.phoneNumber || 'Not set'}
                </p>
              )}
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin className="w-4 h-4 inline mr-1" />
                Location
              </label>
              {isEditing ? (
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your location"
                />
              ) : (
                <p className="px-3 py-2 bg-gray-50 rounded-lg text-gray-900">
                  {formData.location || 'Not set'}
                </p>
              )}
            </div>

            {/* Account Created */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Member Since
              </label>
              <p className="px-3 py-2 bg-gray-50 rounded-lg text-gray-900">
                {user.metadata?.creationTime 
                  ? new Date(user.metadata.creationTime).toLocaleDateString()
                  : 'Unknown'
                }
              </p>
            </div>
          </div>

          {/* Bio */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bio
            </label>
            {isEditing ? (
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleInputChange}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Tell us about yourself..."
              />
            ) : (
              <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-900 min-h-[100px]">
                {formData.bio || 'No bio added yet'}
              </div>
            )}
          </div>
        </div>

        {/* Account Stats */}
        <div className="bg-white rounded-lg shadow-sm p-6 mt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Activity</h2>
          {statsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="animate-pulse">
                    <div className="h-8 bg-gray-200 rounded mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.activeListings}</div>
                <div className="text-sm text-gray-600">Active Listings</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{stats.communitiesJoined}</div>
                <div className="text-sm text-gray-600">Communities Joined</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">{stats.messagesSent}</div>
                <div className="text-sm text-gray-600">Messages Sent</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
