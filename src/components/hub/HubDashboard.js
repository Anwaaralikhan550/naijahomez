'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Users,
  MessageCircle,
  Calendar,
  AlertTriangle,
  ShoppingBag,
  Bell,
  Settings,
  LogOut,
  User,
  Menu,
  X,
  ChevronDown,
  Search,
  Mail,
  Key,
  MessageSquare,
  Clock,
  Zap,
  Droplets,
  Shield,
  Phone,
  Eye,
  Plus,
  CheckCircle
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authenticatedFetch } from '@/services/api';
import toast from 'react-hot-toast';
import VisitorBooking from './VisitorBooking';
import IssueReporting from './IssueReporting';
import Marketplace from './Marketplace';
import EmergencyAlerts from './EmergencyAlerts';
import Notifications from './Notifications';
import Amenities from './Amenities';
import HubAdmin from './HubAdmin';
import CommunitySwitcher from './CommunitySwitcher';
import CommunitySearch from './CommunitySearch';
import AccessCodeRequest from './AccessCodeRequest';
import CommunityCreator from './CommunityCreator';
import CommunityForum from './CommunityForum';
import MemberDirectory from './MemberDirectory';
import CommunityChat from './CommunityChat';
import CommunityEvents from './CommunityEvents';
import PrivateMessages from './PrivateMessages';
import CommunitySocialFeed from './CommunitySocialFeed';
import RealtimeNotifications from '@/components/shared/RealtimeNotifications';
import ConnectionStatus from '@/components/shared/ConnectionStatus';
import { useResponsive, useMobileNavigation } from '@/hooks/useResponsive';
// Smart Services Components
import GeneratorNetwork from './smart-services/GeneratorNetwork';
import WaterScheduling from './smart-services/WaterScheduling';
// Emergency/Safety Components  
import EmergencyContacts from './emergency/EmergencyContacts';

const HubDashboard = ({ accessCodeData }) => {
  const { user, signOut } = useAuth();
  const { isMobile, isTablet, screenSize } = useResponsive();
  const { isMenuOpen, openMenu, closeMenu, toggleMenu } = useMobileNavigation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [currentCommunity, setCurrentCommunity] = useState(null);
  const [userRole, setUserRole] = useState('member');
  const [userMembership, setUserMembership] = useState(null);
  const [showCommunitySwitcher, setShowCommunitySwitcher] = useState(false);
  const [communityName, setCommunityName] = useState('Loading...');
  const [communitiesLoaded, setCommunitiesLoaded] = useState(false);
  const [hasNoCommunities, setHasNoCommunities] = useState(false);
  const [showCommunitySearch, setShowCommunitySearch] = useState(false);
  const [showAccessCodeRequest, setShowAccessCodeRequest] = useState(false);
  const [showCommunityCreator, setShowCommunityCreator] = useState(false);
  const [userCommunities, setUserCommunities] = useState([]);
  const [publicCommunities, setPublicCommunities] = useState([]);
  // Join request state tracking for browse communities
  const [joinRequests, setJoinRequests] = useState([]);
  const [joiningCommunity, setJoiningCommunity] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    social: true,
    'smart-services': false,
    'safety-emergency': false,
    services: false,
    management: false
  });

  const loadCommunityName = useCallback(async (communityId) => {
    try {
      const response = await authenticatedFetch(`/api/hub/communities?id=${communityId}`);
      const result = await response.json();
      if (result.community) {
        setCommunityName(result.community.name);
      }
    } catch (error) {
      console.error('Error loading community name:', error);
    }
  }, []);

  const loadUserCommunities = useCallback(async () => {
    const currentUserId = user?.uid;
    console.log('loadUserCommunities called for user:', currentUserId);
    
    if (!currentUserId) {
      console.log('No user.uid available, skipping community loading');
      return;
    }
    
    try {
      // Load user's communities
      const userResponse = await authenticatedFetch(`/api/hub/communities?type=user&userId=${currentUserId}`);
      console.log('API response status:', userResponse.status);
      
      if (!userResponse.ok) {
        const errorText = await userResponse.text();
        console.error('Failed to fetch user communities:', errorText);
        throw new Error('Failed to fetch user communities');
      }
      
      const userData = await userResponse.json();
      
      const memberships = userData.communities || [];
      setUserCommunities(memberships);
      
      if (memberships.length > 0) {
        // Use first community as default
        const primaryMembership = memberships[0];
        console.log('Setting currentCommunity from primaryMembership:', primaryMembership);
        console.log('Community ID being set:', primaryMembership.id);
        setCurrentCommunity(primaryMembership.id);
        setUserRole(primaryMembership.role);
        setUserMembership(primaryMembership);
        setCommunityName(primaryMembership.name);
        setHasNoCommunities(false);
      } else {
        // User has no Hub communities yet
        setHasNoCommunities(true);
      }
      
      // Load public communities for discovery
      const publicResponse = await authenticatedFetch('/api/hub/communities?type=public');

      if (publicResponse.ok) {
        const publicData = await publicResponse.json();
        setPublicCommunities(publicData.communities || []);
      }
      
      setCommunitiesLoaded(true);
    } catch (error) {
      console.error('Error loading user communities:', error);
      setCommunitiesLoaded(true);
      // Still try to load public communities even if user communities fail
      try {
        const publicResponse = await authenticatedFetch('/api/hub/communities?type=public');
        if (publicResponse.ok) {
          const publicData = await publicResponse.json();
          setPublicCommunities(publicData.communities || []);
        }
      } catch (publicError) {
        console.error('Failed to load public communities as fallback:', publicError);
      }
    }
  }, [user?.uid]);

  // Load user's join requests for browse communities
  const loadUserJoinRequests = useCallback(async () => {
    const currentUserId = user?.uid;
    if (!currentUserId) return;
    try {
      const response = await authenticatedFetch(`/api/hub/join-requests?userId=${currentUserId}`);
      if (response.ok) {
        const result = await response.json();
        setJoinRequests(result.requests || []);
      }
    } catch (error) {
      console.error('Error loading user join requests:', error);
    }
  }, [user?.uid]);

  // Initialize community and role data
  useEffect(() => {
    console.log('useEffect triggered - user:', user?.uid, 'accessCodeData:', accessCodeData);
    if (accessCodeData) {
      // User authenticated with access code
      setCurrentCommunity(accessCodeData.communityId);
      setUserRole(accessCodeData.role);
      loadCommunityName(accessCodeData.communityId);
    } else if (user?.uid) {
      // User authenticated with email/password - load their communities
      console.log('Loading communities for user:', user.uid);
      loadUserCommunities();
      loadUserJoinRequests();
    } else {
      // User is null/signed out - clear state
      setCurrentCommunity(null);
      setUserRole(null);
      setUserCommunities([]);
    }
  }, [accessCodeData, loadCommunityName, loadUserCommunities, loadUserJoinRequests, user?.uid]);

  // Get button state for a community in browse section
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

  // Handle join request for browse communities
  const handleBrowseJoinRequest = (community) => {
    setJoiningCommunity(community.id);
    setShowCommunitySearch(true);
    // The CommunitySearch modal will handle the actual join request
    // Reset joining state when modal closes
    setTimeout(() => setJoiningCommunity(null), 100);
  };

  const handleLogout = async () => {
    try {
      if (accessCodeData) {
        // Clear access code data
        localStorage.removeItem('hubAccessCode');
        window.location.href = '/';
      } else {
        // Use the platform's logout function that clears cookies and Firebase auth
        const result = await signOut();
        if (result.error) {
          throw new Error(result.error);
        }
        toast.success('✅ Logged out successfully!');
        window.location.href = '/';
      }
    } catch (error) {
      toast.error('❌ Failed to logout');
    }
  };

  const handleCommunityChange = (newCommunityData) => {
    setCurrentCommunity(newCommunityData.communityId);
    setUserRole(newCommunityData.role);
    setUserMembership(newCommunityData.membership);
    loadCommunityName(newCommunityData.communityId);
    setHasNoCommunities(false);
  };

  const handleCommunityCreated = (communityData) => {
    handleCommunityChange(communityData);
  };

  // Debug logging for role

  const menuSections = [
    {
      id: 'main',
      label: '',
      items: [
        { id: 'dashboard', label: 'Community Hub', icon: Building2 },
        { id: 'my-communities', label: 'My Communities', icon: Building2 },
        { id: 'browse-communities', label: 'Browse Communities', icon: Search }
      ]
    },
    {
      id: 'social',
      label: 'Social & Community',
      icon: MessageSquare,
      items: [
        { id: 'feed', label: 'Community Feed', icon: MessageSquare },
        { id: 'messages', label: 'Private Messages', icon: Mail },
        { id: 'events', label: 'Events & Calendar', icon: Calendar },
        { id: 'directory', label: 'Member Directory', icon: Users }
      ]
    },
    {
      id: 'smart-services',
      label: 'Smart Services',
      icon: Zap,
      items: [
        { id: 'generator-network', label: 'Generator Network', icon: Zap },
        { id: 'water-scheduling', label: 'Water Orders', icon: Droplets },
        { id: 'security-coordination', label: 'Security Guards', icon: Shield },
        { id: 'internet-sharing', label: 'Internet Sharing', icon: Bell }
      ]
    },
    {
      id: 'safety-emergency',
      label: 'Safety & Emergency',
      icon: Phone,
      items: [
        { id: 'emergency-contacts', label: 'Emergency Contacts', icon: Phone },
        { id: 'community-watch', label: 'Community Watch', icon: Eye },
        { id: 'incident-reports', label: 'Report Incident', icon: AlertTriangle },
        { id: 'weather-alerts', label: 'Weather & Alerts', icon: Bell }
      ]
    },
    {
      id: 'services',
      label: 'Services & Bookings',
      icon: Clock,
      items: [
        { id: 'visitors', label: 'Visitor Booking', icon: User },
        { id: 'amenities', label: 'Amenity Booking', icon: Clock },
        { id: 'marketplace', label: 'Marketplace', icon: ShoppingBag }
      ]
    },
    {
      id: 'management',
      label: 'Management & Support',
      icon: AlertTriangle,
      items: [
        { id: 'issues', label: 'Report Issues', icon: AlertTriangle },
        { id: 'alerts', label: 'Emergency Alerts', icon: Bell },
        { id: 'notifications', label: 'Notifications', icon: Key }
      ]
    },
    ...(userRole === 'admin' ? [{
      id: 'admin',
      label: '',
      items: [
        { id: 'admin', label: 'Admin Panel', icon: Settings }
      ]
    }] : [])
  ];

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const quickActions = [
    {
      title: 'Generator Sharing',
      description: 'Coordinate backup power with neighbors',
      icon: Zap,
      color: 'bg-yellow-500',
      action: () => setActiveSection('generator-network')
    },
    {
      title: 'Emergency Contacts',
      description: 'Quick access to emergency services',
      icon: Phone,
      color: 'bg-red-500',
      action: () => setActiveSection('emergency-contacts')
    },
    {
      title: 'Water Orders',
      description: 'Join bulk water delivery orders',
      icon: Droplets,
      color: 'bg-blue-500',
      action: () => setActiveSection('water-scheduling')
    },
    {
      title: 'Book Visitor Code',
      description: 'Schedule a visitor and get access code',
      icon: Users,
      color: 'bg-green-500',
      action: () => setActiveSection('visitors')
    },
    {
      title: 'Report Issue',
      description: 'Report maintenance or community issues',
      icon: MessageCircle,
      color: 'bg-orange-500',
      action: () => setActiveSection('issues')
    },
    {
      title: 'Browse Marketplace',
      description: 'Buy and sell within the community',
      icon: ShoppingBag,
      color: 'bg-purple-500',
      action: () => setActiveSection('marketplace')
    }
  ];

  const renderDashboardContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            {/* Welcome Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Welcome back, {user?.displayName || (accessCodeData ? `Access User` : 'Hub Member')}!
              </h2>
              {/* Debug Panel */}
              <div className="mt-4 p-3 bg-gray-100 rounded text-xs space-y-1">
                <div><strong>Debug State:</strong></div>
                <div>currentCommunity: {String(currentCommunity)}</div>
                <div>userRole: {userRole}</div>
                <div>communitiesLoaded: {String(communitiesLoaded)}</div>
                <div>hasNoCommunities: {String(hasNoCommunities)}</div>
                <div>userCommunities.length: {userCommunities.length}</div>
              </div>
              <p className="text-gray-600 mt-4">
                {accessCodeData 
                  ? `You're accessing the community with ${accessCodeData.role} privileges.`
                  : 'Manage your community activities and stay connected with your neighbors.'
                }
              </p>
              {!currentCommunity && !accessCodeData && (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-yellow-800 text-sm">
                    You're not a member of any community yet. Ask your admin for an access code or join a community.
                  </p>
                </div>
              )}
            </div>

            {/* Quick Actions Grid */}
            <div className={`grid gap-4 sm:gap-6 ${
              isMobile ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
            }`}>
              {quickActions.map((action, index) => (
                <div
                  key={index}
                  onClick={action.action}
                  className={`bg-white rounded-lg shadow hover:shadow-lg transition cursor-pointer ${
                    isMobile ? 'p-4' : 'p-6'
                  }`}
                >
                  <div className={`${
                    isMobile ? 'w-10 h-10 mb-3' : 'w-12 h-12 mb-4'
                  } ${action.color} rounded-lg flex items-center justify-center`}>
                    <action.icon className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} text-white`} />
                  </div>
                  <h3 className={`font-semibold text-gray-900 mb-2 ${
                    isMobile ? 'text-sm' : 'text-base'
                  }`}>{action.title}</h3>
                  <p className={`text-gray-600 ${
                    isMobile ? 'text-xs' : 'text-sm'
                  }`}>{action.description}</p>
                </div>
              ))}
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
              <div className="space-y-3">
                <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                  <Bell className="w-5 h-5 text-blue-500 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">New community notification</p>
                    <p className="text-xs text-gray-500">2 hours ago</p>
                  </div>
                </div>
                <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                  <Users className="w-5 h-5 text-green-500 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Visitor code sent</p>
                    <p className="text-xs text-gray-500">1 day ago</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'my-communities':
        return (
          <div className="space-y-6">
            {/* Debug Info for Development */}
            {process.env.NODE_ENV === 'development' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm">
                <p><strong>Debug My Communities:</strong></p>
                <p>User ID: {user?.uid}</p>
                <p>Communities loaded: {communitiesLoaded ? 'Yes' : 'No'}</p>
                <p>User communities: {userCommunities.length}</p>
                <p>Has no communities: {hasNoCommunities ? 'Yes' : 'No'}</p>
                {userCommunities.length > 0 && (
                  <details className="mt-2">
                    <summary>Community details</summary>
                    <pre className="mt-2 text-xs overflow-auto">
                      {JSON.stringify(userCommunities, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )}
            
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">My Communities</h2>
              <p className="text-gray-600 mb-6">Communities where you are a member</p>
              
              {userCommunities.length === 0 ? (
                <div className="text-center py-8">
                  <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">You're not a member of any communities yet</p>
                  <button
                    onClick={() => setActiveSection('browse-communities')}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                  >
                    Browse Communities
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {userCommunities.map((community) => (
                    <div
                      key={community.id}
                      className="border border-gray-200 rounded-lg p-6 hover:border-blue-300 hover:shadow-md transition"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Building2 className="w-6 h-6 text-blue-600" />
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                          community.role === 'admin' 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {community.role}
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-2">{community.name}</h3>
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                        {community.description || 'No description available'}
                      </p>
                      <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                        <span>{community.memberCount || 0} members</span>
                        <span>{community.isPublic ? 'Public' : 'Private'}</span>
                      </div>
                      <button
                        onClick={() => {
                          handleCommunityChange({
                            communityId: community.id,
                            role: community.role,
                            membership: community
                          });
                          setActiveSection('dashboard');
                        }}
                        className="w-full bg-blue-50 text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-100 transition"
                      >
                        Switch to Community
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      case 'browse-communities':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Browse Communities</h2>
              <p className="text-gray-600 mb-6">Discover and join public communities</p>
              
              {publicCommunities.length === 0 ? (
                <div className="text-center py-8">
                  <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">No public communities available at the moment</p>
                  <button
                    onClick={() => setShowCommunityCreator(true)}
                    className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition"
                  >
                    Create Your Community
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Top Public Communities</h3>
                    <button
                      onClick={() => setShowCommunitySearch(true)}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      Search All Communities →
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {publicCommunities.map((community) => {
                      const buttonState = getJoinButtonState(community.id);
                      const buttonConfig = {
                        join: {
                          text: 'Request to Join',
                          className: 'bg-green-50 text-green-600 hover:bg-green-100',
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
                      const config = buttonConfig[buttonState];
                      return (
                        <div
                          key={community.id}
                          className="border border-gray-200 rounded-lg p-6 hover:border-green-300 hover:shadow-md transition"
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                              <Building2 className="w-6 h-6 text-green-600" />
                            </div>
                            <span className="px-2 py-1 text-xs rounded-full font-medium bg-blue-100 text-blue-800">
                              Public
                            </span>
                          </div>
                          <h3 className="font-semibold text-gray-900 mb-2">{community.name}</h3>
                          <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                            {community.description || 'No description available'}
                          </p>
                          <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                            <span>{community.memberCount || 0} members</span>
                            <span>{community.location || 'Location not specified'}</span>
                          </div>
                          <button
                            onClick={() => buttonState === 'join' && handleBrowseJoinRequest(community)}
                            disabled={config.disabled}
                            className={`w-full px-4 py-2 rounded-lg transition flex items-center justify-center ${config.className}`}
                          >
                            {config.icon}
                            {config.text}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      case 'feed':
        return <CommunitySocialFeed 
          communityId={currentCommunity} 
          onNavigateToMessages={(memberId, memberName) => {
            setActiveSection('messages');
            // TODO: Pass selectedMember to PrivateMessages component
          }}
        />;
      case 'forum':
        return <CommunityForum communityId={currentCommunity} />;
      case 'chat':
        return <CommunityChat communityId={currentCommunity} />;
      case 'messages':
        return <PrivateMessages communityId={currentCommunity} />;
      case 'events':
        return <CommunityEvents communityId={currentCommunity} />;
      case 'directory':
        return <MemberDirectory communityId={currentCommunity} />;
      case 'visitors':
        return <VisitorBooking communityId={currentCommunity} />;
      case 'issues':
        console.log('Rendering IssueReporting with currentCommunity:', currentCommunity);
        return <IssueReporting communityId={currentCommunity} />;
      case 'marketplace':
        return <Marketplace communityId={currentCommunity} />;
      case 'alerts':
        return <EmergencyAlerts communityId={currentCommunity} />;
      case 'notifications':
        return <Notifications communityId={currentCommunity} />;
      case 'amenities':
        return <Amenities communityId={currentCommunity} />;
      
      // Smart Services Cases
      case 'generator-network':
        return <GeneratorNetwork communityId={currentCommunity} />;
      case 'water-scheduling':
        return <WaterScheduling communityId={currentCommunity} />;
      case 'security-coordination':
        return (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Security Guard Coordination</h2>
            <p className="text-gray-600">Coming soon! Coordinate shared security guard services with your neighbors.</p>
          </div>
        );
      case 'internet-sharing':
        return (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Internet Sharing</h2>
            <p className="text-gray-600">Coming soon! Share high-speed internet costs with community members.</p>
          </div>
        );
      
      // Safety & Emergency Cases
      case 'emergency-contacts':
        return <EmergencyContacts communityId={currentCommunity} />;
      case 'community-watch':
        return (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Community Watch</h2>
            <p className="text-gray-600">Coming soon! Organize community patrol schedules and safety coordination.</p>
          </div>
        );
      case 'incident-reports':
        return (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Report Incident</h2>
            <p className="text-gray-600">Coming soon! Report security incidents and suspicious activities anonymously.</p>
          </div>
        );
      case 'weather-alerts':
        return (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Weather & Alerts</h2>
            <p className="text-gray-600">Coming soon! Get real-time weather alerts and emergency notifications.</p>
          </div>
        );
      
      case 'admin':
        return (userRole === 'admin') ? <HubAdmin communityId={currentCommunity} /> : renderDashboardContent();
      default:
        return (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {menuSections.flatMap(section => section.items).find(item => item.id === activeSection)?.label}
            </h2>
            <p className="text-gray-600">This feature is coming soon!</p>
          </div>
        );
    }
  };

  // Show loading state while checking communities
  if (user && !communitiesLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your communities...</p>
        </div>
      </div>
    );
  }

  // Show welcome screen for users with no communities
  if (user && communitiesLoaded && hasNoCommunities) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to The Hub!</h1>
            <p className="text-gray-600">Get started by joining a community or using an access code</p>
          </div>

          {/* Options */}
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="space-y-6">
              {/* Search Communities */}
              <div className="flex items-start p-6 border border-gray-200 rounded-lg hover:border-blue-300 transition">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Search className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
                <div className="ml-4 flex-1">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Find Your Community</h3>
                  <p className="text-gray-600 mb-4">Search for your residential community and request to join</p>
                  <button
                    onClick={() => setShowCommunitySearch(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                  >
                    Search Communities
                  </button>
                </div>
              </div>

              {/* Request Access Code */}
              <div className="flex items-start p-6 border border-gray-200 rounded-lg hover:border-green-300 transition">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <Mail className="w-6 h-6 text-green-600" />
                  </div>
                </div>
                <div className="ml-4 flex-1">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Request Access Code</h3>
                  <p className="text-gray-600 mb-4">Don't see your community? Request an access code from your admin</p>
                  <button
                    onClick={() => setShowAccessCodeRequest(true)}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
                  >
                    Request Access Code
                  </button>
                </div>
              </div>

              {/* Create Community */}
              <div className="flex items-start p-6 border border-gray-200 rounded-lg hover:border-orange-300 transition">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-orange-600" />
                  </div>
                </div>
                <div className="ml-4 flex-1">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Create Your Community</h3>
                  <p className="text-gray-600 mb-4">Set up a new residential community and become its admin</p>
                  <button
                    onClick={() => setShowCommunityCreator(true)}
                    className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition"
                  >
                    Create Community
                  </button>
                </div>
              </div>

              {/* Have Access Code */}
              <div className="flex items-start p-6 border border-gray-200 rounded-lg hover:border-purple-300 transition">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Key className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
                <div className="ml-4 flex-1">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Already Have an Access Code?</h3>
                  <p className="text-gray-600 mb-4">Use your access code to join a community directly</p>
                  <button
                    onClick={handleLogout}
                    className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition"
                  >
                    Use Access Code
                  </button>
                </div>
              </div>
            </div>

            {/* Top Public Communities Section */}
            {publicCommunities.length > 0 && (
              <div className="mt-8 pt-6 border-t border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 mb-4 text-center">Popular Communities</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {publicCommunities.slice(0, 4).map((community) => (
                    <div
                      key={community.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-blue-600" />
                        </div>
                        <span className="px-2 py-1 text-xs rounded-full font-medium bg-green-100 text-green-800">
                          Public
                        </span>
                      </div>
                      <h4 className="font-medium text-gray-900 mb-2">{community.name}</h4>
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {community.description || 'No description available'}
                      </p>
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                        <span>👥 {community.memberCount || 0} members</span>
                        <span>📍 {community.location || 'Location not set'}</span>
                      </div>
                      <button
                        onClick={() => {
                          // Handle join community action
                          toast.info('Community join feature coming soon!');
                        }}
                        className="w-full px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition"
                      >
                        View Details
                      </button>
                    </div>
                  ))}
                </div>
                
                {publicCommunities.length > 4 && (
                  <div className="text-center mt-4">
                    <button
                      onClick={() => setShowCommunitySearch(true)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      View all {publicCommunities.length} communities →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* User Info */}
            <div className="mt-8 pt-6 border-t border-gray-200 text-center">
              <p className="text-sm text-gray-600">
                Logged in as <span className="font-medium">{user.email}</span>
              </p>
              <button
                onClick={handleLogout}
                className="mt-2 text-sm text-gray-500 hover:text-gray-700"
              >
                Sign out
              </button>
            </div>
          </div>

          {/* Modals */}
          {showCommunitySearch && (
            <CommunitySearch 
              onClose={() => setShowCommunitySearch(false)}
            />
          )}
          {showAccessCodeRequest && (
            <AccessCodeRequest 
              onClose={() => setShowAccessCodeRequest(false)}
            />
          )}
          {showCommunityCreator && (
            <CommunityCreator 
              onClose={() => setShowCommunityCreator(false)}
              onSuccess={handleCommunityCreated}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile Sidebar Overlay */}
      {(isMobile ? isMenuOpen : sidebarOpen) && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={isMobile ? closeMenu : () => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed top-0 bottom-0 left-0 z-50 ${isMobile ? 'w-80' : 'w-64'} bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:transform-none lg:top-24 lg:z-40 ${
        isMobile 
          ? (isMenuOpen ? 'translate-x-0' : '-translate-x-full') 
          : (sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0')
      }`}>
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center">
            <Building2 className="w-8 h-8 text-blue-600 mr-2" />
            <div>
              <span className="text-xl font-bold text-gray-900">The Hub</span>
              {!accessCodeData && user && (
                <button
                  onClick={() => setShowCommunitySwitcher(true)}
                  className="block text-sm text-blue-600 hover:text-blue-700 flex items-center mt-1"
                >
                  {communityName}
                  <ChevronDown className="w-4 h-4 ml-1" />
                </button>
              )}
              {accessCodeData && (
                <div className="text-sm text-gray-500">{communityName}</div>
              )}
            </div>
          </div>
          <button
            onClick={isMobile ? closeMenu : () => setSidebarOpen(false)}
            className="lg:hidden text-gray-500 hover:text-gray-700 p-2 -mr-2 rounded-md"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="mt-6 overflow-y-auto">
          {menuSections.map((section) => (
            <div key={section.id} className="mb-2">
              {section.label && (
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between px-4 py-2 text-left text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
                >
                  <div className="flex items-center">
                    {section.icon && <section.icon className="w-4 h-4 mr-2" />}
                    {section.label}
                  </div>
                  <ChevronDown 
                    className={`w-4 h-4 transition-transform ${
                      expandedSections[section.id] ? 'rotate-180' : ''
                    }`} 
                  />
                </button>
              )}
              
              <div className={`${section.label && !expandedSections[section.id] ? 'hidden' : ''}`}>
                {section.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveSection(item.id);
                      if (isMobile) {
                        closeMenu();
                      } else {
                        setSidebarOpen(false);
                      }
                    }}
                    className={`w-full flex items-center px-4 py-3 text-left hover:bg-gray-100 transition ${
                      section.label ? 'pl-8' : ''
                    } ${
                      activeSection === item.id ? 'bg-blue-50 text-blue-600 border-r-2 border-blue-600' : 'text-gray-700'
                    }`}
                  >
                    <item.icon className="w-5 h-5 mr-3" />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t">
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 lg:ml-64">
        {/* Top Bar */}
        <div className="bg-white shadow-sm border-b px-4 py-4 flex items-center justify-between lg:mt-24">
          <button
            onClick={isMobile ? toggleMenu : () => setSidebarOpen(true)}
            className="lg:hidden text-gray-500 hover:text-gray-700 p-2 -ml-2 rounded-md"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <div className="flex items-center space-x-4">
            {/* Real-time connection status (only show if there's a community) */}
            {currentCommunity && user && (
              <ConnectionStatus 
                communityId={currentCommunity.id}
                userId={user.uid}
                className="mr-2"
              />
            )}
            
            {/* Real-time notifications */}
            {currentCommunity && user && (
              <RealtimeNotifications
                communityId={currentCommunity.id}
                userId={user.uid}
                className="mr-2"
              />
            )}
            
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">
                {user?.displayName || (accessCodeData ? `Access User (${accessCodeData.code})` : 'Hub Member')}
              </p>
              <p className="text-xs text-gray-500">
                {user?.email || (accessCodeData ? `Role: ${accessCodeData.role}` : 'Guest')}
              </p>
            </div>
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className={`${isMobile ? 'p-4' : 'p-6'} ${isMobile ? 'pb-20' : ''}`}>
          {renderDashboardContent()}
        </div>
      </div>

      {/* Community Switcher Modal */}
      {showCommunitySwitcher && !accessCodeData && user && (
        <CommunitySwitcher 
          currentCommunity={currentCommunity}
          onCommunityChange={handleCommunityChange}
          onClose={() => setShowCommunitySwitcher(false)}
        />
      )}
    </div>
  );
};

export default HubDashboard;
