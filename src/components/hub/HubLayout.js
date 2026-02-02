'use client';
import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Building2, 
  Users, 
  MessageCircle, 
  Calendar, 
  ShoppingBag,
  Bell,
  Settings,
  Menu,
  X,
  Search,
  Mail,
  MessageSquare,
  Home,
  UsersIcon,
  Rss,
  AlertTriangle,
  UserCheck,
  Dumbbell,
  Zap,
  Droplets,
  Shield,
  Phone,
  Eye,
  ChevronDown,
  ChevronRight,
  Wifi,
  Cloud
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authenticatedFetch } from '@/services/api';
import NotificationCenter from '@/components/hub/NotificationCenter';

const HubLayout = ({ children, communityId }) => {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [userCommunities, setUserCommunities] = useState([]);
  const [currentCommunity, setCurrentCommunity] = useState(null);
  const [showCommunitySelector, setShowCommunitySelector] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    'main': true,
    'social': false,
    'smart-services': false,
    'safety': false,
    'services': false,
    'support': false
  });

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-expand section based on current path
  useEffect(() => {
    const findActiveSectionId = () => {
      const allCategories = [...navigationCategories];
      if (userRole === 'admin') allCategories.push(adminSection);
      
      for (const category of allCategories) {
        const hasActivePage = category.items.some(item => isActivePath(item.path));
        if (hasActivePage && category.label) {
          setExpandedSections(prev => ({
            ...prev,
            [category.id]: true
          }));
          break;
        }
      }
    };

    findActiveSectionId();
  }, [pathname, userRole]);

  // Load user communities and set current community
  useEffect(() => {
    const loadUserCommunities = async () => {
      if (user?.uid) {
        try {
          // Get user's communities
          const response = await authenticatedFetch(`/api/hub/communities?type=user&userId=${user.uid}`);
          const result = await response.json();

          if (response.ok && result.communities?.length > 0) {
            setUserCommunities(result.communities);
            
            // Check if user is admin in any community
            const isAdmin = result.communities.some(c => c.role === 'admin');
            setUserRole(isAdmin ? 'admin' : 'member');
            
            // Set current community based on prop, localStorage, or default selection
            let communityToSelect = null;
            
            // First priority: communityId prop (from URL parameter)
            if (communityId) {
              const propCommunity = result.communities.find(c => c.id === communityId);
              if (propCommunity) {
                communityToSelect = propCommunity;
                console.log('Selected community from prop:', propCommunity.name);
                // Update localStorage to match the prop selection
                localStorage.setItem('hubCurrentCommunity', communityId);
              } else {
                console.warn('Community from prop not found in user communities:', communityId);
              }
            }
            
            // Second priority: localStorage
            if (!communityToSelect) {
              const stored = localStorage.getItem('hubCurrentCommunity');
              const storedCommunity = stored && result.communities.find(c => c.id === stored);
              if (storedCommunity) {
                communityToSelect = storedCommunity;
              }
            }
            
            // Third priority: default selection (admin community or first)
            if (!communityToSelect) {
              const adminCommunity = result.communities.find(c => c.role === 'admin');
              communityToSelect = adminCommunity || result.communities[0];
              localStorage.setItem('hubCurrentCommunity', communityToSelect.id);
            }
            
            setCurrentCommunity(communityToSelect);
          } else {
            setUserRole('member');
          }
        } catch (error) {
          console.error('Error loading user communities:', error);
          setUserRole('member');
        }
      } else {
        // User is null/signed out - clear community data
        setUserCommunities([]);
        setCurrentCommunity(null);
        setUserRole(null);
      }
    };

    loadUserCommunities();
  }, [user, communityId]);

  // Handle community switching
  const switchCommunity = (community) => {
    setCurrentCommunity(community);
    localStorage.setItem('hubCurrentCommunity', community.id);
    setShowCommunitySelector(false);
    
    // Refresh current page to update data with new community
    window.location.reload();
  };

  // Organized navigation structure
  const navigationCategories = [
    {
      id: 'main',
      label: null, // No label for main items
      items: [
        {
          id: 'dashboard',
          name: 'Dashboard',
          path: '/the-hub/dashboard',
          icon: Home,
          description: 'Hub overview',
          requiresAuth: true
        },
        {
          id: 'communities',
          name: 'Communities',
          path: '/the-hub/communities', 
          icon: Building2,
          description: 'Browse and join',
          requiresAuth: false
        }
      ]
    },
    {
      id: 'social',
      label: 'Social & Community',
      icon: MessageSquare,
      items: [
        {
          id: 'feed',
          name: 'Community Feed',
          path: '/the-hub/feed',
          icon: Rss,
          description: 'Posts and updates',
          requiresAuth: true
        },
        {
          id: 'events',
          name: 'Events',
          path: '/the-hub/events',
          icon: Calendar,
          description: 'Community events',
          requiresAuth: true
        },
        {
          id: 'messages',
          name: 'Messages',
          path: '/the-hub/messages',
          icon: Mail,
          description: 'Private messages',
          requiresAuth: true
        },
        {
          id: 'marketplace',
          name: 'Marketplace',
          path: '/the-hub/marketplace',
          icon: ShoppingBag,
          description: 'Buy and sell',
          requiresAuth: true
        }
      ]
    },
    {
      id: 'smart-services',
      label: 'Smart Services',
      icon: Zap,
      items: [
        {
          id: 'generator-network',
          name: 'Generator Network',
          path: '/the-hub/generator-network',
          icon: Zap,
          description: 'Power sharing',
          requiresAuth: true
        },
        {
          id: 'water-scheduling',
          name: 'Water Orders',
          path: '/the-hub/water-scheduling', 
          icon: Droplets,
          description: 'Bulk delivery',
          requiresAuth: true
        },
        {
          id: 'security-coordination',
          name: 'Security Guards',
          path: '/the-hub/security-coordination',
          icon: Shield,
          description: 'Shared security',
          requiresAuth: true
        },
        {
          id: 'internet-sharing',
          name: 'Internet Sharing',
          path: '/the-hub/internet-sharing',
          icon: Wifi,
          description: 'Cost sharing',
          requiresAuth: true
        }
      ]
    },
    {
      id: 'safety',
      label: 'Safety & Emergency',
      icon: Shield,
      items: [
        {
          id: 'emergency-contacts',
          name: 'Emergency Contacts',
          path: '/the-hub/emergency-contacts',
          icon: Phone,
          description: 'Quick access',
          requiresAuth: true
        },
        {
          id: 'community-watch',
          name: 'Community Watch',
          path: '/the-hub/community-watch',
          icon: Eye,
          description: 'Patrol schedules',
          requiresAuth: true
        },
        {
          id: 'incident-reports',
          name: 'Report Incident',
          path: '/the-hub/incident-reports',
          icon: AlertTriangle,
          description: 'Security incidents',
          requiresAuth: true
        },
        {
          id: 'weather-alerts',
          name: 'Weather & Alerts',
          path: '/the-hub/weather-alerts',
          icon: Cloud,
          description: 'Real-time alerts',
          requiresAuth: true
        }
      ]
    },
    {
      id: 'services',
      label: 'Services & Bookings',
      icon: Calendar,
      items: [
        {
          id: 'visitors',
          name: 'Visitor Management',
          path: '/the-hub/visitors',
          icon: UserCheck,
          description: 'Access codes',
          requiresAuth: true
        },
        {
          id: 'amenities',
          name: 'Amenities',
          path: '/the-hub/amenities',
          icon: Dumbbell,
          description: 'Book facilities',
          requiresAuth: true
        }
      ]
    },
    {
      id: 'support',
      label: 'Support & Notifications',
      icon: Bell,
      items: [
        {
          id: 'issues',
          name: 'Report Issues',
          path: '/the-hub/issues',
          icon: AlertTriangle,
          description: 'Maintenance',
          requiresAuth: true
        },
        {
          id: 'alerts',
          name: 'Emergency Alerts',
          path: '/the-hub/alerts',
          icon: Bell,
          description: 'Community alerts',
          requiresAuth: true
        },
        {
          id: 'notifications',
          name: 'Notifications',
          path: '/the-hub/notifications',
          icon: Bell,
          description: 'Your notifications',
          requiresAuth: true
        }
      ]
    }
  ];

  // Admin section (only shown to admins)
  const adminSection = {
    id: 'admin',
    label: null,
    items: [
      {
        id: 'admin',
        name: 'Admin Panel',
        path: '/the-hub/admin',
        icon: Settings,
        description: 'Community admin',
        adminOnly: true,
        requiresAuth: true
      }
    ]
  };

  // Toggle section expansion
  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  // Filter items based on auth and role
  const filterItems = (items) => {
    return items.filter(item => {
      if (item.requiresAuth && !user) return false;
      if (item.adminOnly && userRole !== 'admin') return false;
      return true;
    });
  };


  const isActivePath = (path) => {
    if (path === '/the-hub/dashboard') {
      return pathname === '/the-hub' || pathname === '/the-hub/dashboard';
    }
    return pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Mobile menu toggle button (only shown on mobile when menu is closed) */}
        {isMobile && !isMenuOpen && (
          <button
            onClick={() => setIsMenuOpen(true)}
            className="fixed top-4 left-4 z-40 p-2 bg-white shadow-lg rounded-md border text-gray-600 hover:text-gray-900"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Sidebar Navigation */}
        <nav className={`
          ${isMobile ? 'fixed inset-y-0 left-0 z-50' : 'sticky top-0 h-screen'}
          ${isMobile && !isMenuOpen ? 'hidden' : 'block'}
          w-64 bg-white shadow-lg border-r border-gray-200 overflow-y-auto
        `}>
          {/* Sidebar Header */}
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Building2 className="w-6 h-6 text-blue-600" />
                <div className="ml-2">
                  <h1 className="text-lg font-bold text-gray-900">The Hub</h1>
                  <p className="text-xs text-gray-500">Community Management</p>
                </div>
              </div>
              
              {/* Notification Center */}
              {user && currentCommunity && (
                <NotificationCenter communityId={currentCommunity.id || currentCommunity} />
              )}
              {isMobile && (
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="p-1 text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
          
          {/* Community Selector for authenticated users */}
          {user && currentCommunity && userCommunities.length > 0 && (
            <div className="p-4 border-b border-gray-200">
              <div className="relative">
                <button
                  onClick={() => setShowCommunitySelector(!showCommunitySelector)}
                  className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                >
                  <div className="flex items-center">
                    <Building2 className="w-4 h-4 text-gray-600 mr-2" />
                    <div className="text-left">
                      <div className="text-sm font-medium text-gray-900 truncate max-w-[120px]">
                        {currentCommunity.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {currentCommunity.role === 'admin' ? 'Admin' : 'Member'}
                      </div>
                    </div>
                  </div>
                  <div className="text-gray-400">
                    {showCommunitySelector ? '▲' : '▼'}
                  </div>
                </button>
                
                {/* Dropdown */}
                {showCommunitySelector && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                    {userCommunities.map((community) => (
                      <button
                        key={community.id}
                        onClick={() => switchCommunity(community)}
                        className={`w-full flex items-center p-3 hover:bg-gray-50 transition ${
                          community.id === currentCommunity.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                        }`}
                      >
                        <Building2 className="w-4 h-4 mr-2" />
                        <div className="flex-1 text-left">
                          <div className="text-sm font-medium truncate">
                            {community.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {community.role === 'admin' ? 'Admin' : 'Member'} • {community.memberCount} members
                          </div>
                        </div>
                        {community.id === currentCommunity.id && (
                          <div className="text-blue-600">✓</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Guest user welcome section */}
          {!user && (
            <div className="p-4 border-b border-gray-200">
              <div className="text-center space-y-3">
                <div className="text-sm text-gray-600">
                  Join communities to access all features
                </div>
                <div className="space-y-2">
                  <button
                    onClick={() => router.push('/login?returnUrl=/the-hub')}
                    className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => router.push('/register?returnUrl=/the-hub')}
                    className="w-full px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition"
                  >
                    Sign Up
                  </button>
                </div>
              </div>
            </div>
          )}
          
          <div className="p-4">
            <div className="space-y-4">
              {/* Render navigation categories */}
              {navigationCategories
                .concat(userRole === 'admin' ? [adminSection] : [])
                .map((category) => {
                  const filteredItems = filterItems(category.items);
                  if (filteredItems.length === 0) return null;
                  
                  const CategoryIcon = category.icon;
                  const isExpanded = expandedSections[category.id] ?? true;
                  
                  return (
                    <div key={category.id}>
                      {/* Category header (collapsible if has label) */}
                      {category.label ? (
                        <button
                          onClick={() => toggleSection(category.id)}
                          className="w-full flex items-center justify-between px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 rounded-lg transition"
                        >
                          <div className="flex items-center space-x-2">
                            {CategoryIcon && <CategoryIcon className="w-4 h-4" />}
                            <span>{category.label}</span>
                          </div>
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                      ) : null}
                      
                      {/* Category items */}
                      <div className={`
                        ${category.label ? (isExpanded ? 'block' : 'hidden') : 'block'}
                        ${category.label ? 'ml-4 mt-1' : ''}
                        space-y-1
                      `}>
                        {filteredItems.map((item) => {
                          const isActive = isActivePath(item.path);
                          const Icon = item.icon;
                          
                          return (
                            <button
                              key={item.id}
                              onClick={() => {
                                router.push(item.path);
                                if (isMobile) setIsMenuOpen(false);
                              }}
                              className={`
                                w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition
                                ${isActive 
                                  ? 'bg-blue-50 text-blue-700 border-l-2 border-blue-600' 
                                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                }
                              `}
                            >
                              <Icon className="w-5 h-5 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium">{item.name}</p>
                                {item.description && (
                                  <p className="text-xs text-gray-500">{item.description}</p>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile overlay */}
      {isMobile && isMenuOpen && (
        <div 
          className="fixed inset-0 bg-gray-600 bg-opacity-75 z-40"
          onClick={() => setIsMenuOpen(false)}
        />
      )}
    </div>
  );
};

export default HubLayout;