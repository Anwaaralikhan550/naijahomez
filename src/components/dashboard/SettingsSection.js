'use client';
import React, { useState, useEffect } from 'react';
import { 
  User, 
  Bell, 
  Shield, 
  Key, 
  Save,
  Camera,
  Loader2,
  Mail,
  Trash2
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { OptimizedUpload } from '@/utils/optimizedUpload';
import toast from 'react-hot-toast';

export default function SettingsSection() {
  const { user, updateProfile } = useAuth();
  const [activeSection, setActiveSection] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  
  // Profile settings
  const [profileData, setProfileData] = useState({
    displayName: '',
    phoneNumber: '',
    bio: '',
    photoURL: ''
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
        bio: user.bio || '',
        photoURL: user.photoURL || ''
      });
    }
  }, [user]);

  const getInitials = () => {
    const name = profileData.displayName || user?.displayName || user?.email || 'User';
    return name
      .split(/[ @._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'U';
  };

  const handlePhotoUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type?.startsWith('image/')) {
      toast.error('Please choose an image file.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Profile photo must be smaller than 10MB.');
      return;
    }

    setPhotoUploading(true);
    try {
      const photoURL = await OptimizedUpload.uploadSingleFile(file, 'profiles', null, user?.uid, {
        thresholdBytes: 0,
        maxWidth: 512,
        maxHeight: 512,
        quality: 0.82,
        outputType: 'image/webp',
        fit: 'cover'
      });

      const result = await updateProfile({ photoURL });
      if (result?.error) throw new Error(result.error);

      setProfileData((current) => ({ ...current, photoURL }));
      toast.success('Profile photo updated.');
    } catch (error) {
      console.error('Profile photo upload error:', error);
      toast.error(error.message || 'Failed to upload profile photo.');
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    setPhotoUploading(true);
    try {
      const result = await updateProfile({ photoURL: '' });
      if (result?.error) throw new Error(result.error);

      setProfileData((current) => ({ ...current, photoURL: '' }));
      toast.success('Profile photo removed.');
    } catch (error) {
      console.error('Profile photo remove error:', error);
      toast.error(error.message || 'Failed to remove profile photo.');
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleProfileSave = async () => {
    setLoading(true);
    try {
      // Include all profile fields in the update
      await updateProfile({
        displayName: profileData.displayName,
        phoneNumber: profileData.phoneNumber,
        bio: profileData.bio,
        photoURL: profileData.photoURL
      });

      toast.success('Profile updated successfully.');
    } catch (error) {
      toast.error('Failed to update profile.');
      console.error('Profile update error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationSave = () => {
    // Save notification preferences to localStorage or backend
    localStorage.setItem('notificationPreferences', JSON.stringify(notifications));
    toast.success('Notification preferences saved.');
  };

  const handlePrivacySave = () => {
    // Save privacy settings to localStorage or backend
    localStorage.setItem('privacySettings', JSON.stringify(privacy));
    toast.success('Privacy settings saved.');
  };

  const sections = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'privacy', label: 'Privacy', icon: Shield },
    { id: 'account', label: 'Account', icon: Key }
  ];

  const kycStatus = String(user?.kycStatus || 'unverified').toLowerCase();
  const isUnverified = kycStatus !== 'verified';
  const readableKycStatus = kycStatus.charAt(0).toUpperCase() + kycStatus.slice(1);

  const renderProfileSection = () => (
    <div className="space-y-6">
      <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative aspect-square h-20 w-20 shrink-0 overflow-hidden rounded-full bg-blue-600 text-white shadow-sm ring-2 ring-white">
            {profileData.photoURL ? (
              <img
                src={profileData.photoURL}
                alt={profileData.displayName || 'Profile photo'}
                className="block h-full w-full object-cover object-center"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xl font-semibold">
                {getInitials()}
              </div>
            )}
            {photoUploading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/55">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : null}
          </div>

          <div className="min-w-0 flex-1">
            <h4 className="font-semibold text-gray-900">Profile photo</h4>
            <p className="mt-1 text-sm text-gray-600">
              Upload a clear photo so agents and buyers can recognize your account.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
                {photoUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                {profileData.photoURL ? 'Change photo' : 'Upload photo'}
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/avif,image/heic,image/heif"
                  className="hidden"
                  onChange={handlePhotoUpload}
                  disabled={photoUploading}
                />
              </label>
              {profileData.photoURL ? (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  disabled={photoUploading}
                  className="inline-flex items-center rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

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
      {isUnverified && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-800">
            Verify your account to boost trust and improve listing performance.
          </p>
          <p className="text-xs text-amber-700 mt-1">
            Current KYC status: {readableKycStatus}. Visit the Verification tab to upload your documents.
          </p>
        </div>
      )}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
          <h2 className="text-2xl font-bold text-white">Settings</h2>
          <p className="text-blue-100">Manage your account preferences</p>
          <p className="text-xs text-blue-100 mt-1">KYC Status: {readableKycStatus}</p>
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
