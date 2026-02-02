'use client';
import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Users, 
  Settings, 
  MessageCircle, 
  AlertTriangle,
  Bell,
  Calendar,
  ShoppingBag,
  BarChart3,
  Plus,
  Edit,
  Trash2,
  Send,
  Eye,
  Filter,
  Download
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authenticatedFetch } from '@/services/api';
import toast from 'react-hot-toast';
import MemberManagement from './admin/MemberManagement';
import NotificationSender from './admin/NotificationSender';
import IssueManagement from './admin/IssueManagement';
import EmergencyAlertManager from './admin/EmergencyAlertManager';
import AmenityManagement from './admin/AmenityManagement';
import AccessCodeGenerator from './admin/AccessCodeGenerator';

const HubAdmin = ({ communityId: propCommunityId }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [currentCommunity, setCurrentCommunity] = useState(propCommunityId || null);
  const [stats, setStats] = useState({
    totalMembers: 0,
    activeIssues: 0,
    pendingVisitors: 0,
    marketplaceItems: 0,
    notificationsThisMonth: 0,
    activeAmenities: 0,
    activeAlerts: 0,
    pendingJoinRequests: 0,
    recentActivity: []
  });

  const adminTabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'issues', label: 'Issues', icon: MessageCircle },
    { id: 'alerts', label: 'Emergency Alerts', icon: AlertTriangle },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'amenities', label: 'Amenities', icon: Calendar },
    { id: 'access-codes', label: 'Access Codes', icon: Settings },
    { id: 'settings', label: 'Community Settings', icon: Settings },
  ];

  // Get current community from localStorage or user memberships
  useEffect(() => {
    const loadCommunity = async () => {
      if (propCommunityId) {
        setCurrentCommunity(propCommunityId);
        return;
      }

      if (user) {
        try {
          // Check localStorage first
          const stored = localStorage.getItem('hubCurrentCommunity');
          if (stored) {
            setCurrentCommunity(stored);
            return;
          }

          // Get user's communities to find admin community
          const response = await authenticatedFetch(`/api/hub/communities?type=user&userId=${user.uid}`);
          const result = await response.json();

          if (response.ok && result.communities?.length > 0) {
            // Find admin community first, or fallback to first community
            const adminCommunity = result.communities.find(c => c.role === 'admin');
            if (adminCommunity) {
              setCurrentCommunity(adminCommunity.id);
            } else {
              setCurrentCommunity(result.communities[0].id);
            }
          }
        } catch (error) {
          console.error('Error loading community:', error);
        }
      }
    };

    loadCommunity();
  }, [user, propCommunityId]);

  useEffect(() => {
    if (currentCommunity && user?.uid) {
      loadDashboardStats();
    }
  }, [currentCommunity, user?.uid]);

  const loadDashboardStats = async () => {
    try {
      setLoading(true);

      const response = await authenticatedFetch(`/api/hub/dashboard-stats?communityId=${currentCommunity}&userId=${user.uid}`);
      const result = await response.json();
      
      
      if (response.ok) {
        setStats(result.stats || {
          totalMembers: 0,
          activeIssues: 0,
          pendingVisitors: 0,
          marketplaceItems: 0,
          notificationsThisMonth: 0,
          activeAmenities: 0,
          activeAlerts: 0,
          pendingJoinRequests: 0,
          recentActivity: []
        });
      } else {
        console.error('Failed to load stats:', result.error);
        // Fallback to default stats
        setStats({
          totalMembers: 0,
          activeIssues: 0,
          pendingVisitors: 0,
          marketplaceItems: 0,
          notificationsThisMonth: 0,
          activeAmenities: 0,
          activeAlerts: 0,
          pendingJoinRequests: 0,
          recentActivity: []
        });
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      // Fallback to default stats
      setStats({
        totalMembers: 0,
        activeIssues: 0,
        pendingVisitors: 0,
        marketplaceItems: 0,
        notificationsThisMonth: 0,
        activeAmenities: 0,
        activeAlerts: 0,
        pendingJoinRequests: 0,
        recentActivity: []
      });
    } finally {
      setLoading(false);
    }
  };

  const renderOverview = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-gray-900">Community Overview</h3>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Members</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalMembers}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <MessageCircle className="w-6 h-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Issues</p>
              <p className="text-2xl font-bold text-gray-900">{stats.activeIssues}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Calendar className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Today's Visitors</p>
              <p className="text-2xl font-bold text-gray-900">{stats.pendingVisitors}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <ShoppingBag className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Marketplace Items</p>
              <p className="text-2xl font-bold text-gray-900">{stats.marketplaceItems}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Bell className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Notifications This Month</p>
              <p className="text-2xl font-bold text-gray-900">{stats.notificationsThisMonth}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Settings className="w-6 h-6 text-indigo-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Amenities</p>
              <p className="text-2xl font-bold text-gray-900">{stats.activeAmenities}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Alerts</p>
              <p className="text-2xl font-bold text-gray-900">{stats.activeAlerts}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pending Join Requests</p>
              <p className="text-2xl font-bold text-gray-900">{stats.pendingJoinRequests}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h4 className="text-lg font-semibold text-gray-900">Recent Activity</h4>
        </div>
        <div className="p-6">
          {stats.recentActivity && stats.recentActivity.length > 0 ? (
            <div className="space-y-4">
              {stats.recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center p-3 bg-gray-50 rounded-lg">
                  <MessageCircle className="w-5 h-5 text-red-500 mr-3" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      New issue reported: {activity.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      By {activity.reporterName} • {activity.createdAt && new Date(activity.createdAt.toDate ? activity.createdAt.toDate() : activity.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500">No recent activity</p>
              <p className="text-sm text-gray-400">Community activity will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderMembers = () => (
    <MemberManagement communityId={currentCommunity} />
  );

  const renderIssues = () => (
    <IssueManagement communityId={currentCommunity} />
  );

  const renderAlerts = () => (
    <EmergencyAlertManager communityId={currentCommunity} />
  );

  const renderNotifications = () => (
    <NotificationSender communityId={currentCommunity} />
  );

  const renderAmenities = () => (
    <AmenityManagement communityId={currentCommunity} />
  );

  const renderAccessCodes = () => (
    <AccessCodeGenerator communityId={currentCommunity} />
  );

  const renderSettings = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-gray-900">Community Settings</h3>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Community Name</label>
              <input
                type="text"
                defaultValue="Sample Estate"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <textarea
                rows={3}
                defaultValue="123 Estate Road, Lagos, Nigeria"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
              <input
                type="email"
                defaultValue="admin@sampleestate.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Security Phone</label>
              <input
                type="tel"
                defaultValue="+234-123-456-7890"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact</label>
              <input
                type="tel"
                defaultValue="+234-987-654-3210"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Office Hours</label>
              <input
                type="text"
                defaultValue="8:00 AM - 6:00 PM"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition">
          Save Settings
        </button>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview': return renderOverview();
      case 'members': return renderMembers();
      case 'issues': return renderIssues();
      case 'alerts': return renderAlerts();
      case 'notifications': return renderNotifications();
      case 'amenities': return renderAmenities();
      case 'access-codes': return renderAccessCodes();
      case 'settings': return renderSettings();
      default: return renderOverview();
    }
  };

  // Show loading state if no community detected
  if (!currentCommunity) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Loading community...</p>
          <p className="text-sm text-gray-400 mt-1">Please wait while we load your admin dashboard</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <Shield className="w-6 h-6 mr-2 text-blue-600" />
            Admin Dashboard
          </h2>
          <p className="text-gray-600">Manage your community</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {adminTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4 mr-2" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-96">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default HubAdmin;