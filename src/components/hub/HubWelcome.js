'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Building2, 
  Users, 
  MessageCircle, 
  Calendar, 
  ShoppingBag,
  TrendingUp,
  Activity,
  Clock,
  ChevronRight,
  Plus
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authenticatedFetch } from '@/services/api';
import CommunityCreator from './CommunityCreator';

const HubWelcome = () => {
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({
    totalCommunities: 0,
    userCommunities: 0,
    recentActivity: 0,
    unreadMessages: 0
  });
  const [userCommunities, setUserCommunities] = useState([]);
  const [publicCommunities, setPublicCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCommunityCreator, setShowCommunityCreator] = useState(false);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const loadDashboardData = async () => {
      try {
        // Load user communities
        const userResponse = await authenticatedFetch(`/api/hub/communities?type=user&userId=${user.uid}`);
        let userResult;
        if (userResponse.ok) {
          userResult = await userResponse.json();
          setUserCommunities(userResult.communities || []);
        }

        // Load popular public communities
        const publicResponse = await authenticatedFetch('/api/hub/communities?type=public');
        let publicResult;
        if (publicResponse.ok) {
          publicResult = await publicResponse.json();
          setPublicCommunities(publicResult.communities || []);
        }

        // Update stats
        setStats(prev => ({
          ...prev,
          userCommunities: userResult?.communities?.length || 0,
          totalCommunities: publicResult?.communities?.length || 0
        }));

      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [user?.uid]);

  const handleCommunityCreated = (newCommunity) => {
    // Reload dashboard data to include new community
    if (user?.uid) {
      const loadDashboardData = async () => {
        try {
          const userResponse = await authenticatedFetch(`/api/hub/communities?type=user&userId=${user.uid}`);
          if (userResponse.ok) {
            const userResult = await userResponse.json();
            setUserCommunities(userResult.communities || []);
          }
        } catch (error) {
          console.error('Error reloading communities:', error);
        }
      };
      loadDashboardData();
    }
  };

  const quickActions = [
    {
      title: 'Community Feed',
      description: 'See latest posts and updates',
      icon: MessageCircle,
      color: 'bg-blue-500',
      path: '/the-hub/feed'
    },
    {
      title: 'Browse Communities',
      description: 'Find and join new communities',
      icon: Building2,
      color: 'bg-green-500', 
      path: '/the-hub/communities'
    },
    {
      title: 'Events',
      description: 'View upcoming community events',
      icon: Calendar,
      color: 'bg-orange-500',
      path: '/the-hub/events'
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome to The Hub, {user?.displayName?.split(' ')[0] || 'there'}! 👋
            </h1>
            <p className="text-gray-600 mt-1">
              Your central hub for community management and social interaction
            </p>
          </div>
          <div className="hidden md:block">
            <Building2 className="w-16 h-16 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">{stats.userCommunities}</p>
              <p className="text-gray-600 text-sm">Your Communities</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Users className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">{stats.totalCommunities}</p>
              <p className="text-gray-600 text-sm">Total Communities</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Activity className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">{stats.recentActivity}</p>
              <p className="text-gray-600 text-sm">Recent Activity</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <MessageCircle className="w-6 h-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">{stats.unreadMessages}</p>
              <p className="text-gray-600 text-sm">Unread Messages</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <button
                key={index}
                onClick={() => router.push(action.path)}
                className="flex items-center p-4 border border-gray-200 rounded-lg hover:shadow-md transition group"
              >
                <div className={`p-3 ${action.color} rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="ml-4 flex-1 text-left">
                  <h3 className="font-medium text-gray-900 group-hover:text-blue-600">
                    {action.title}
                  </h3>
                  <p className="text-sm text-gray-500">{action.description}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Your Communities */}
      {userCommunities.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Your Communities</h2>
            <button
              onClick={() => router.push('/the-hub/communities')}
              className="text-blue-600 hover:underline text-sm"
            >
              View All
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {userCommunities.slice(0, 4).map((community) => (
              <div key={community.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900">{community.name}</h3>
                  <span className="text-xs text-gray-500">
                    {community.memberCount} members
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  {community.description?.substring(0, 100)}...
                </p>
                <button
                  onClick={() => router.push('/the-hub/feed')}
                  className="text-blue-600 hover:underline text-sm"
                >
                  View Feed →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Community Section */}
      {userCommunities.length === 0 ? (
        /* First-time users - prominent create section */
        <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-lg shadow p-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-orange-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Create Your Community</h2>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Start your own residential community and become the admin. Connect with neighbors, manage amenities, and build a thriving community.
            </p>
            <button
              onClick={() => setShowCommunityCreator(true)}
              className="bg-orange-600 text-white px-8 py-3 rounded-lg hover:bg-orange-700 transition font-medium flex items-center mx-auto"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create Your First Community
            </button>
          </div>
        </div>
      ) : (
        /* Existing users - smaller create another section */
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Expand Your Network</h2>
              <p className="text-gray-600 text-sm">Create or manage additional communities</p>
            </div>
            <div className="flex gap-2">
              {userCommunities.some(c => c.role === 'admin') && (
                <button
                  onClick={() => router.push('/the-hub/admin')}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm"
                >
                  Admin Panel
                </button>
              )}
              <button
                onClick={() => setShowCommunityCreator(true)}
                className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition flex items-center text-sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                Create Community
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popular Communities */}
      {publicCommunities.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Popular Communities</h2>
            <button
              onClick={() => router.push('/the-hub/communities')}
              className="text-blue-600 hover:underline text-sm"
            >
              Browse All
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {publicCommunities.slice(0, 6).map((community) => (
              <div key={community.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900">{community.name}</h3>
                  <span className="text-xs text-gray-500">
                    {community.memberCount} members
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  {community.description?.substring(0, 80)}...
                </p>
                <p className="text-xs text-gray-500">📍 {community.location}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Community Creator Modal */}
      {showCommunityCreator && (
        <CommunityCreator 
          onClose={() => setShowCommunityCreator(false)}
          onSuccess={handleCommunityCreated}
        />
      )}
    </div>
  );
};

export default HubWelcome;