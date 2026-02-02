'use client';
import React, { useState } from 'react';
import { 
  Building2, 
  Users, 
  Search, 
  Lock, 
  Mail, 
  Eye, 
  EyeOff,
  ArrowRight 
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import CommunitySearch from './CommunitySearch';
import AccessCodeRequest from './AccessCodeRequest';

const HubAuth = () => {
  const { signIn } = useAuth();
  const [activeTab, setActiveTab] = useState('login');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    accessCode: '',
    communityName: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCommunitySearch, setShowCommunitySearch] = useState(false);
  const [showAccessCodeRequest, setShowAccessCodeRequest] = useState(false);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (activeTab === 'login') {
        const { error } = await signIn(formData.email, formData.password);
        if (error) {
          throw new Error(error);
        }
        toast.success('✅ Welcome to The Hub!', {
          duration: 3000,
          position: 'top-center',
          style: {
            background: '#10B981',
            color: 'white',
            fontWeight: 'bold',
            padding: '16px',
            borderRadius: '8px'
          }
        });
      } else if (activeTab === 'accessCode') {
        // Validate access code first
        const validateResponse = await fetch('/api/hub/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'validate_access_code',
            accessCode: formData.accessCode
          })
        });

        if (!validateResponse.ok) {
          throw new Error('Failed to validate access code');
        }
        const validateResult = await validateResponse.json();

        if (!validateResult.valid) {
          throw new Error(validateResult.error || 'Invalid access code');
        }

        // Create anonymous user session with access code data (encrypted)
        const { secureLocalStorage } = await import('@/utils/encryption');
        await secureLocalStorage.setItem('hubAccessCode', {
          code: formData.accessCode,
          communityId: validateResult.communityId,
          role: validateResult.role,
          codeId: validateResult.codeId
        });

        // Mark access code as used
        await fetch('/api/hub/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'use_access_code',
            userId: `access-${validateResult.codeId}`,
            codeId: validateResult.codeId,
            currentUsedCount: 0 // Will be updated by backend
          })
        });

        toast.success('✅ Access code verified!', {
          duration: 3000,
          position: 'top-center',
          style: {
            background: '#10B981',
            color: 'white',
            fontWeight: 'bold',
            padding: '16px',
            borderRadius: '8px'
          }
        });

        // Trigger page reload to show dashboard
        window.location.reload();
      }
    } catch (error) {
      toast.error(`❌ ${error.message}`, {
        duration: 4000,
        position: 'top-center',
        style: {
          background: '#EF4444',
          color: 'white',
          fontWeight: 'bold',
          padding: '16px',
          borderRadius: '8px'
        }
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">The Hub</h1>
          <p className="text-gray-600">Community Management Platform</p>
        </div>

        {/* Auth Tabs */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          {/* Tab Navigation */}
          <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('login')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition ${
                activeTab === 'login'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Mail className="w-4 h-4 inline mr-2" />
              Email Login
            </button>
            <button
              onClick={() => setActiveTab('accessCode')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition ${
                activeTab === 'accessCode'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Lock className="w-4 h-4 inline mr-2" />
              Access Code
            </button>
          </div>

          <form onSubmit={handleLogin}>
            {activeTab === 'login' && (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter your email"
                    required
                  />
                </div>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                      placeholder="Enter your password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'accessCode' && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Access Code
                </label>
                <input
                  type="text"
                  name="accessCode"
                  value={formData.accessCode}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your access code"
                  required
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </button>
          </form>

          {/* Additional Options */}
          <div className="mt-6 space-y-3">
            <button 
              onClick={() => setShowCommunitySearch(true)}
              className="w-full text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center justify-center"
            >
              <Search className="w-4 h-4 mr-2" />
              Search Hub Community
            </button>
            <button 
              onClick={() => setShowCommunitySearch(true)}
              className="w-full text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center justify-center"
            >
              <Users className="w-4 h-4 mr-2" />
              Request to Join Community
            </button>
            <button 
              onClick={() => setShowAccessCodeRequest(true)}
              className="w-full text-gray-600 hover:text-gray-700 text-sm font-medium"
            >
              Request New Access Code
            </button>
          </div>
        </div>
      </div>

      {/* Community Search Modal */}
      {showCommunitySearch && (
        <CommunitySearch 
          onClose={() => setShowCommunitySearch(false)}
        />
      )}

      {/* Access Code Request Modal */}
      {showAccessCodeRequest && (
        <AccessCodeRequest 
          onClose={() => setShowAccessCodeRequest(false)}
        />
      )}
    </div>
  );
};

export default HubAuth;