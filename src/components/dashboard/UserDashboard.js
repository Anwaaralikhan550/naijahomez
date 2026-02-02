// Updated UserDashboard component
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
  LogOut
} from 'lucide-react';

// Import new section components
import PostAdSection from './PostAdSection';
import MyAdsSection from './MyAdsSection';
import NotificationsSection from './NotificationsSection';
import SettingsSection from './SettingsSection';

const UserDashboard = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('post-ad');
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Existing user data loading logic

  const renderSectionContent = () => {
    switch(activeTab) {
      case 'post-ad':
        return <PostAdSection />;
      case 'my-ads':
        return <MyAdsSection />;
      case 'notifications':
        return <NotificationsSection />;
      case 'settings':
        return <SettingsSection />;
      default:
        return null;
    }
  };

  // Rest of the component remains similar to your existing implementation

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Sidebar remains the same */}
          <div className="w-64 shrink-0">
            {/* Existing sidebar code */}
          </div>

          {/* Main Content */}
          <div className="flex-grow">
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-2xl font-bold text-blue-900 mb-6">
                {/* Dynamic title based on active tab */}
                {activeTab === 'post-ad' && 'Post New Ad'}
                {activeTab === 'my-ads' && 'My Ads'}
                {activeTab === 'notifications' && 'Notifications'}
                {activeTab === 'settings' && 'Settings'}
              </h2>
              
              {renderSectionContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;