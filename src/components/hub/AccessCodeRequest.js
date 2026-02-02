'use client';
import React, { useState } from 'react';
import { 
  X,
  Send,
  User,
  Mail,
  MessageCircle,
  Phone,
  Building2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { authenticatedFetch } from '@/services/api';
import CommunitySearch from './CommunitySearch';

const AccessCodeRequest = ({ onClose }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    requesterName: '',
    requesterEmail: '',
    contactInfo: '',
    reason: '',
    selectedCommunity: null
  });
  const [loading, setLoading] = useState(false);
  const [showCommunitySearch, setShowCommunitySearch] = useState(false);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleCommunitySelect = (community) => {
    setFormData({
      ...formData,
      selectedCommunity: community
    });
    setShowCommunitySearch(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.selectedCommunity) {
      toast.error('Please select a community');
      return;
    }

    if (!formData.requesterName.trim() || !formData.requesterEmail.trim() || !formData.reason.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      if (!user?.uid) {
        toast.error('Please sign in to request access');
        return;
      }
      setLoading(true);
      const response = await authenticatedFetch(`/api/hub/access-code-requests?userId=${user.uid}`, {
        method: 'POST',
        body: JSON.stringify({
          action: 'create_request',
          communityId: formData.selectedCommunity.id,
          requesterName: formData.requesterName,
          requesterEmail: formData.requesterEmail,
          contactInfo: formData.contactInfo,
          reason: formData.reason
        })
      });

      const result = await response.json();

      if (response.ok) {
        toast.success('✅ Access code request submitted successfully!', {
          duration: 5000,
          position: 'top-center',
          style: {
            background: '#10B981',
            color: 'white',
            fontWeight: 'bold',
            padding: '16px',
            borderRadius: '8px'
          }
        });

        onClose();
      } else {
        throw new Error(result.error || 'Failed to submit request');
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Request Access Code</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Community Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Community *
            </label>
            {formData.selectedCommunity ? (
              <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-center">
                  <Building2 className="w-5 h-5 text-blue-600 mr-2" />
                  <div>
                    <p className="font-medium text-gray-900">{formData.selectedCommunity.name}</p>
                    <p className="text-sm text-gray-600">{formData.selectedCommunity.address}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCommunitySearch(true)}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Change
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowCommunitySearch(true)}
                className="w-full p-3 border-2 border-dashed border-gray-300 rounded-md text-gray-600 hover:border-gray-400 hover:text-gray-700 transition flex items-center justify-center"
              >
                <Building2 className="w-5 h-5 mr-2" />
                Select Community
              </button>
            )}
          </div>

          {/* Personal Information */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Full Name *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                name="requesterName"
                value={formData.requesterName}
                onChange={handleInputChange}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your full name"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address *
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="email"
                name="requesterEmail"
                value={formData.requesterEmail}
                onChange={handleInputChange}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your email address"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contact Information (Optional)
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                name="contactInfo"
                value={formData.contactInfo}
                onChange={handleInputChange}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Phone number or alternative contact"
              />
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Request *
            </label>
            <div className="relative">
              <MessageCircle className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
              <textarea
                name="reason"
                value={formData.reason}
                onChange={handleInputChange}
                rows={4}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Please explain why you need access to this community (e.g., resident, visitor, service provider, etc.)"
                required
              />
            </div>
          </div>

          {/* Info Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex">
              <div className="text-sm text-blue-700">
                <p className="font-medium mb-1">How it works:</p>
                <ul className="space-y-1 text-xs">
                  <li>• Your request will be sent to the community administrators</li>
                  <li>• If approved, you'll receive an access code via email</li>
                  <li>• Use the access code to join the community</li>
                  <li>• Response time is typically 1-3 business days</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Submit Request
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Community Search Modal */}
      {showCommunitySearch && (
        <CommunitySearch 
          onClose={() => setShowCommunitySearch(false)}
          onSelect={handleCommunitySelect}
        />
      )}
    </div>
  );
};

export default AccessCodeRequest;