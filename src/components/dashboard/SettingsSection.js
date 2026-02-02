'use client';
import React, { useState, useEffect } from 'react';
import { 
  User, 
  Bell, 
  Shield, 
  Key, 
  Save,
  Edit,
  Phone,
  Mail,
  Eye,
  EyeOff
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

export default function SettingsSection() {
  const { user, updateProfile } = useAuth();
  const [activeSection, setActiveSection] = useState('profile');
  const [loading, setLoading] = useState(false);
  
  // Profile settings
  const [profileData, setProfileData] = useState({
    displayName: '',
    phoneNumber: '',
    bio: ''
  });
  
  // Notification settings
  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    newMessages: true,
    adResponses: true,
    marketingEmails: false
  });
  
  // Privacy settings
  const [privacy, setPrivacy] = useState({
    phoneVisible: true,
    profilePublic: true,
    showOnlineStatus: true
  });

  useEffect(() => {
    if (user) {
      setProfileData({
        displayName: user.displayName || '',
        phoneNumber: user.phoneNumber || '',
        bio: user.bio || ''
      });
    }
  }, [user]);

  const handleProfileSave = async () => {
    setLoading(true);
    try {
      // Include all profile fields in the update
      await updateProfile({
        displayName: profileData.displayName,
        phoneNumber: profileData.phoneNumber,
        bio: profileData.bio
      });

      toast.success('✅ Profile updated successfully!');
    } catch (error) {
      toast.error('❌ Failed to update profile');
      console.error('Profile update error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationSave = () => {
    // Save notification preferences to localStorage or backend
    localStorage.setItem('notificationPreferences', JSON.stringify(notifications));
    toast.success('✅ Notification preferences saved!');
  };

  const handlePrivacySave = () => {
    // Save privacy settings to localStorage or backend
    localStorage.setItem('privacySettings', JSON.stringify(privacy));
    toast.success('✅ Privacy settings saved!');
  };

  const sections = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'privacy', label: 'Privacy', icon: Shield },
    { id: 'account', label: 'Account', icon: Key }
  ];

  const renderProfileSection = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Display Name
        </label>
        <input
          type="text"
          value={profileData.displayName}
          onChange={(e) => setProfileData({...profileData, displayName: e.target.value})}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Your display name"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Phone Number
        </label>
        <input
          type="tel"
          value={profileData.phoneNumber}
          onChange={(e) => setProfileData({...profileData, phoneNumber: e.target.value})}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="+1 (555) 123-4567"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Bio
        </label>
        <textarea
          value={profileData.bio}
          onChange={(e) => setProfileData({...profileData, bio: e.target.value})}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Tell others about yourself..."
        />
      </div>
      
      <button
        onClick={handleProfileSave}
        disabled={loading}
        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        <Save className="w-4 h-4 mr-2" />
        {loading ? 'Saving...' : 'Save Profile'}
      </button>
    </div>
  );

  const renderNotificationsSection = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium">Email Notifications</h4>
            <p className="text-sm text-gray-500">Receive notifications via email</p>
          </div>
          <input
            type="checkbox"
            checked={notifications.emailNotifications}
            onChange={(e) => setNotifications({...notifications, emailNotifications: e.target.checked})}
            className="w-4 h-4 text-blue-600"
          />
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium">New Messages</h4>
            <p className="text-sm text-gray-500">Get notified of new messages</p>
          </div>
          <input
            type="checkbox"
            checked={notifications.newMessages}
            onChange={(e) => setNotifications({...notifications, newMessages: e.target.checked})}
            className="w-4 h-4 text-blue-600"
          />
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium">Ad Responses</h4>
            <p className="text-sm text-gray-500">Notifications for responses to your ads</p>
          </div>
          <input
            type="checkbox"
            checked={notifications.adResponses}
            onChange={(e) => setNotifications({...notifications, adResponses: e.target.checked})}
            className="w-4 h-4 text-blue-600"
          />
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium">Marketing Emails</h4>
            <p className="text-sm text-gray-500">Updates and promotional content</p>
          </div>
          <input
            type="checkbox"
            checked={notifications.marketingEmails}
            onChange={(e) => setNotifications({...notifications, marketingEmails: e.target.checked})}
            className="w-4 h-4 text-blue-600"
          />
        </div>
      </div>
      
      <button
        onClick={handleNotificationSave}
        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        <Save className="w-4 h-4 mr-2" />
        Save Preferences
      </button>
    </div>
  );

  const renderPrivacySection = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium">Show Phone Number</h4>
            <p className="text-sm text-gray-500">Make your phone number visible to others</p>
          </div>
          <input
            type="checkbox"
            checked={privacy.phoneVisible}
            onChange={(e) => setPrivacy({...privacy, phoneVisible: e.target.checked})}
            className="w-4 h-4 text-blue-600"
          />
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium">Public Profile</h4>
            <p className="text-sm text-gray-500">Allow others to view your profile</p>
          </div>
          <input
            type="checkbox"
            checked={privacy.profilePublic}
            onChange={(e) => setPrivacy({...privacy, profilePublic: e.target.checked})}
            className="w-4 h-4 text-blue-600"
          />
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium">Show Online Status</h4>
            <p className="text-sm text-gray-500">Let others see when you're online</p>
          </div>
          <input
            type="checkbox"
            checked={privacy.showOnlineStatus}
            onChange={(e) => setPrivacy({...privacy, showOnlineStatus: e.target.checked})}
            className="w-4 h-4 text-blue-600"
          />
        </div>
      </div>
      
      <button
        onClick={handlePrivacySave}
        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        <Save className="w-4 h-4 mr-2" />
        Save Settings
      </button>
    </div>
  );

  const renderAccountSection = () => (
    <div className="space-y-6">
      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="font-medium mb-2">Account Information</h4>
        <div className="space-y-2 text-sm">
          <div className="flex items-center">
            <Mail className="w-4 h-4 mr-2 text-gray-500" />
            <span>Email: {user?.email}</span>
          </div>
          <div className="flex items-center">
            <User className="w-4 h-4 mr-2 text-gray-500" />
            <span>Member since: {user?.metadata?.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString() : 'Unknown'}</span>
          </div>
        </div>
      </div>
      
      <div className="space-y-3">
        <button className="w-full flex items-center justify-center px-4 py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50">
          <Key className="w-4 h-4 mr-2" />
          Change Password
        </button>
        
        <button className="w-full flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
          <User className="w-4 h-4 mr-2" />
          Delete Account
        </button>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'profile': return renderProfileSection();
      case 'notifications': return renderNotificationsSection();
      case 'privacy': return renderPrivacySection();
      case 'account': return renderAccountSection();
      default: return renderProfileSection();
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
          <h2 className="text-2xl font-bold text-white">Settings</h2>
          <p className="text-blue-100">Manage your account preferences</p>
        </div>
        
        <div className="flex">
          {/* Sidebar */}
          <div className="w-1/4 bg-gray-50 p-4">
            <nav className="space-y-2">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center px-3 py-2 text-left rounded-md transition ${
                    activeSection === section.id
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <section.icon className="w-4 h-4 mr-3" />
                  {section.label}
                </button>
              ))}
            </nav>
          </div>
          
          {/* Content */}
          <div className="flex-1 p-6">
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-gray-900 capitalize">
                {activeSection} Settings
              </h3>
            </div>
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}