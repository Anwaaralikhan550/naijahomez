'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
  Download,
  LogOut,
  BadgeCheck,
  FileText,
  Megaphone
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
import KycApprovals from './admin/KycApprovals';
import ListingReportManagement from './admin/ListingReportManagement';
import ContentAutomationDashboard from './admin/ContentAutomationDashboard';
import AdvertisingManagement from './admin/AdvertisingManagement';
import SupportManagement from './admin/SupportManagement';
import AgentOutreachMonitor from './admin/AgentOutreachMonitor';

const DEFAULT_STATS = {
  totalMembers: 0,
  activeIssues: 0,
  pendingVisitors: 0,
  marketplaceItems: 0,
  notificationsThisMonth: 0,
  activeAmenities: 0,
  activeAlerts: 0,
  pendingJoinRequests: 0,
  recentActivity: []
};

const ADMIN_TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'members', label: 'Members', icon: Users },
  { id: 'kyc-approvals', label: 'KYC Approvals', icon: BadgeCheck },
  { id: 'issues', label: 'Issues', icon: MessageCircle },
  { id: 'alerts', label: 'Emergency Alerts', icon: AlertTriangle },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'amenities', label: 'Amenities', icon: Calendar },
  { id: 'access-codes', label: 'Access Codes', icon: Settings },
  { id: 'content-automation', label: 'Content Automation', icon: FileText },
  { id: 'advertising', label: 'Advertising', icon: Megaphone },
  { id: 'agent-outreach', label: 'Agent Outreach', icon: Send },
  { id: 'support', label: 'Support', icon: MessageCircle },
  { id: 'market-insights', label: 'Market Insights', icon: Eye },
  { id: 'reports', label: 'Reports', icon: AlertTriangle },
  { id: 'settings', label: 'Community Settings', icon: Settings },
];

const HubAdmin = ({ communityId: propCommunityId }) => {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [currentCommunity, setCurrentCommunity] = useState(propCommunityId || null);
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [marketInsights, setMarketInsights] = useState([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState('');

  const loadDashboardStats = useCallback(async () => {
    try {
      setLoading(true);

      const response = await authenticatedFetch(`/api/hub/dashboard-stats?communityId=${currentCommunity}&userId=${user.uid}`);
      const result = await response.json();
      
      
      if (response.ok) {
        setStats(result.stats || DEFAULT_STATS);
      } else {
        console.error('Failed to load stats:', result.error);
        // Fallback to default stats
        setStats(DEFAULT_STATS);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      // Fallback to default stats
      setStats(DEFAULT_STATS);
    } finally {
      setLoading(false);
    }
  }, [currentCommunity, user?.uid]);

  const loadMarketInsights = useCallback(async () => {
    try {
      setInsightsLoading(true);
      setInsightsError('');

      const response = await authenticatedFetch('/api/hub/location-insights');
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result?.error || 'Failed to load market insights');
      }

      setMarketInsights(Array.isArray(result.insights) ? result.insights : []);
    } catch (error) {
      console.error('Error loading market insights:', error);
      setInsightsError(error.message || 'Failed to load market insights');
      setMarketInsights([]);
    } finally {
      setInsightsLoading(false);
    }
  }, []);

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
  }, [currentCommunity, user?.uid, loadDashboardStats]);

  useEffect(() => {
    if (activeTab !== 'market-insights') return;
    loadMarketInsights();
  }, [activeTab, loadMarketInsights]);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
      router.push('/login');
    } catch (error) {
      console.error('Admin sign out error:', error);
      toast.error('Failed to sign out. Please try again.');
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
              {loading ? (
                <div className="h-8 w-14 bg-gray-200 animate-pulse rounded mt-1"></div>
              ) : (
                <p className="text-2xl font-bold text-gray-900">{stats?.totalMembers ?? 0}</p>
              )}
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
              {loading ? (
                <div className="h-8 w-14 bg-gray-200 animate-pulse rounded mt-1"></div>
              ) : (
                <p className="text-2xl font-bold text-gray-900">{stats?.activeIssues ?? 0}</p>
              )}
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
              {loading ? (
                <div className="h-8 w-14 bg-gray-200 animate-pulse rounded mt-1"></div>
              ) : (
                <p className="text-2xl font-bold text-gray-900">{stats?.pendingVisitors ?? 0}</p>
              )}
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
              {loading ? (
                <div className="h-8 w-14 bg-gray-200 animate-pulse rounded mt-1"></div>
              ) : (
                <p className="text-2xl font-bold text-gray-900">{stats?.marketplaceItems ?? 0}</p>
              )}
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
              {loading ? (
                <div className="h-8 w-14 bg-gray-200 animate-pulse rounded mt-1"></div>
              ) : (
                <p className="text-2xl font-bold text-gray-900">{stats?.notificationsThisMonth ?? 0}</p>
              )}
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
              {loading ? (
                <div className="h-8 w-14 bg-gray-200 animate-pulse rounded mt-1"></div>
              ) : (
                <p className="text-2xl font-bold text-gray-900">{stats?.activeAmenities ?? 0}</p>
              )}
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
              {loading ? (
                <div className="h-8 w-14 bg-gray-200 animate-pulse rounded mt-1"></div>
              ) : (
                <p className="text-2xl font-bold text-gray-900">{stats?.activeAlerts ?? 0}</p>
              )}
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
              {loading ? (
                <div className="h-8 w-14 bg-gray-200 animate-pulse rounded mt-1"></div>
              ) : (
                <p className="text-2xl font-bold text-gray-900">{stats?.pendingJoinRequests ?? 0}</p>
              )}
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
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, idx) => (
                <div key={idx} className="flex items-center p-3 bg-gray-50 rounded-lg animate-pulse">
                  <div className="w-5 h-5 bg-gray-200 rounded mr-3"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : stats.recentActivity && stats.recentActivity.length > 0 ? (
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

  const renderKycApprovals = () => (
    <KycApprovals />
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

  const renderReports = () => (
    <ListingReportManagement />
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

  const renderMarketInsights = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Market Insights</h3>
          <p className="text-sm text-gray-500">Top active listing locations across properties and marketplace</p>
        </div>
        <button
          type="button"
          onClick={loadMarketInsights}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Refresh
        </button>
      </div>

      {insightsLoading && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500">Loading market insights...</p>
        </div>
      )}

      {!insightsLoading && insightsError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-700 font-medium">Could not load market insights</p>
          <p className="text-sm text-red-600 mt-1">{insightsError}</p>
        </div>
      )}

      {!insightsLoading && !insightsError && marketInsights.length === 0 && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500">No active location insights available yet.</p>
        </div>
      )}

      {!insightsLoading && !insightsError && marketInsights.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b bg-gray-50">
            <p className="text-sm font-medium text-gray-700">Ranked by active listing count</p>
          </div>
          <div className="divide-y">
            {marketInsights.map((item, index) => {
              const maxCount = marketInsights[0]?.count || 1;
              const width = Math.max(6, Math.round((item.count / maxCount) * 100));

              return (
                <div key={`${item.state}-${item.location}-${index}`} className="p-4">
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">
                        #{index + 1} {item.location}
                      </p>
                      <p className="text-sm text-gray-500 truncate">{item.state}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-blue-700">{item.count}</p>
                      <p className="text-xs text-gray-500">active listings</p>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-blue-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview': return renderOverview();
      case 'members': return renderMembers();
      case 'kyc-approvals': return renderKycApprovals();
      case 'issues': return renderIssues();
      case 'alerts': return renderAlerts();
      case 'notifications': return renderNotifications();
      case 'amenities': return renderAmenities();
      case 'access-codes': return renderAccessCodes();
      case 'content-automation': return <ContentAutomationDashboard />;
      case 'advertising': return <AdvertisingManagement />;
      case 'agent-outreach': return <AgentOutreachMonitor />;
      case 'support': return <SupportManagement />;
      case 'market-insights': return renderMarketInsights();
      case 'reports': return renderReports();
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
        <button
          type="button"
          onClick={handleSignOut}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {ADMIN_TABS.map((tab) => (
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
