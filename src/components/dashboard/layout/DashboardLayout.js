'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
// logOut function now comes from useAuth hook
import { useAuth } from '@/context/AuthContext';
import { 
  Home,
  Package,
  Briefcase,
  PlusCircle,
  Bell,
  Settings,
  LogOut,
  User,
  Loader2,
  MessageCircle,
  Shield
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function DashboardLayout({ children, activeTab: propActiveTab, setActiveTab: propSetActiveTab }) {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState(propActiveTab || 'post-ad');
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Update activeTab when prop changes
  useEffect(() => {
    if (propActiveTab) {
      setActiveTab(propActiveTab);
    }
  }, [propActiveTab]);

  // Load user data when auth user is available
  useEffect(() => {
    const loadUserData = async () => {
      console.log('Dashboard: Loading user data', { user: !!user, authLoading, userEmail: user?.email });
      
      if (authLoading || !user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Use user data from AuthContext (comes from session)
        const userData = {
          email: user.email,
          displayName: user.displayName || user.email?.split('@')[0] || 'User',
          photoURL: user.photoURL,
          uid: user.uid,
          emailVerified: user.emailVerified
        };

        setUserData(userData);
        console.log('Dashboard: User data loaded from session successfully');
      } catch (error) {
        console.error('Error loading user data:', error);
        toast.error('Failed to load user profile');
        // Set basic user data even if Firestore fails
        setUserData({
          email: user.email,
          displayName: user.displayName || user.email?.split('@')[0] || 'User',
          photoURL: user.photoURL,
          uid: user.uid
        });
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, [user, authLoading]);

  // Handle user logout
  const handleLogout = async () => {
    try {
      await signOut();
      router.push('/login');
    } catch (error) {
      console.error('Error logging out:', error);
      toast.error('Failed to log out');
    }
  };

  // Handle tab changes
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (propSetActiveTab) {
      propSetActiveTab(tab);
    }
    router.push(`/dashboard?tab=${tab}`);
  };

  // Generate user initials for avatar
  const getUserInitials = () => {
    if (loading) return '...';
    if (!userData) return 'U';
    
    if (userData.displayName) {
      const names = userData.displayName.split(' ');
      return names.map(name => name[0]).join('').toUpperCase();
    }
    
    return userData.email[0].toUpperCase();
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // This shouldn't happen as auth is handled at page level
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <div className="w-64 shrink-0">
            <div className="bg-white rounded-xl shadow-md p-4">
              {/* User Profile */}
              <div className="flex items-center gap-4 p-4 border-b">
                {userData?.photoURL ? (
                  <img 
                    src={userData.photoURL} 
                    alt={userData.displayName || 'Profile'} 
                    className="w-12 h-12 rounded-full"
                  />
                ) : (
                  <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                    {getUserInitials()}
                  </div>
                )}
                <div>
                  <h3 className="font-semibold">
                    {userData?.displayName || 'User'}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {userData?.email}
                  </p>
                </div>
              </div>
              
              {/* Navigation */}
              <nav className="mt-4">
                {[
                  { id: 'post-ad', label: 'Post New Ad', icon: PlusCircle },
                  { id: 'my-ads', label: 'My Ads', icon: Package },
                  { id: 'messages', label: 'Messages', icon: MessageCircle },
                  ...(userData?.role === 'admin' ? [
                    { id: 'admin-messages', label: 'Admin Messages', icon: Shield }
                  ] : []),
                  { id: 'notifications', label: 'Notifications', icon: Bell },
                  { id: 'settings', label: 'Settings', icon: Settings }
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleTabChange(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      activeTab === item.id
                        ? 'bg-blue-50 text-blue-500'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <item.icon size={20} />
                    <span>{item.label}</span>
                  </button>
                ))}

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-red-500 hover:bg-red-50 mt-4"
                >
                  <LogOut size={20} />
                  <span>Logout</span>
                </button>
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-grow">
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-2xl font-bold text-blue-900 mb-6">
                {activeTab === 'post-ad' && 'Post New Ad'}
                {activeTab === 'my-ads' && 'My Ads'}
                {activeTab === 'messages' && 'Messages'}
                {activeTab === 'admin-messages' && 'Admin Messages'}
                {activeTab === 'notifications' && 'Notifications'}
                {activeTab === 'settings' && 'Settings'}
              </h2>

              {/* Render child components */}
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}