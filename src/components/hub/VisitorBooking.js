'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Calendar, 
  Clock, 
  Phone, 
  MessageCircle, 
  Users, 
  CheckCircle,
  AlertCircle,
  Plus,
  Eye
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authenticatedFetch } from '@/services/api';
import toast from 'react-hot-toast';

const VisitorBooking = ({ communityId: propCommunityId }) => {
  const { user } = useAuth();
  const [visitorCodes, setVisitorCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [currentCommunity, setCurrentCommunity] = useState(propCommunityId || null);
  const [formData, setFormData] = useState({
    visitorName: '',
    visitorPhone: '',
    visitDate: '',
    visitTime: '',
    purpose: '',
    notes: ''
  });

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

          // Get user's communities to find primary community
          const response = await authenticatedFetch(`/api/hub/communities?type=user&userId=${user.uid}`);
          const result = await response.json();

          if (response.ok && result.communities?.length > 0) {
            const primaryCommunity = result.communities.find(c => c.role === 'admin') || result.communities[0];
            setCurrentCommunity(primaryCommunity.id);
          }
        } catch (error) {
          console.error('Error loading community:', error);
        }
      }
    };

    loadCommunity();
  }, [user, propCommunityId]);

  const loadVisitorCodes = useCallback(async () => {
    try {
      setLoading(true);
      const response = await authenticatedFetch(`/api/hub/visitors?userId=${user.uid}&communityId=${currentCommunity}`);
      const result = await response.json();

      if (response.ok) {
        setVisitorCodes(result.codes || []);
      }
    } catch (error) {
      console.error('Error loading visitor codes:', error);
    } finally {
      setLoading(false);
    }
  }, [currentCommunity, user?.uid]);

  useEffect(() => {
    if (user && currentCommunity) {
      loadVisitorCodes();
    }
  }, [user, currentCommunity, loadVisitorCodes]);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const visitDateTime = new Date(`${formData.visitDate}T${formData.visitTime}`);
      
      const response = await authenticatedFetch(`/api/hub/visitors?userId=${user.uid}`, {
        method: 'POST',
        body: JSON.stringify({
          action: 'create_code',
          userId: user.uid,
          communityId: currentCommunity,
          visitorName: formData.visitorName,
          visitorPhone: formData.visitorPhone,
          visitDate: visitDateTime,
          purpose: formData.purpose,
          notes: formData.notes,
          hostName: user.displayName || user.email,
          hostPhone: user.phoneNumber || ''
        })
      });

      const result = await response.json();

      if (response.ok) {
        toast.success('✅ Visitor code created successfully!', {
          duration: 4000,
          position: 'top-center',
          style: {
            background: '#10B981',
            color: 'white',
            fontWeight: 'bold',
            padding: '16px',
            borderRadius: '8px'
          }
        });

        setFormData({
          visitorName: '',
          visitorPhone: '',
          visitDate: '',
          visitTime: '',
          purpose: '',
          notes: ''
        });
        setShowBookingForm(false);
        loadVisitorCodes();
      } else {
        throw new Error(result.error || 'Failed to create visitor code');
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

  const formatDate = (date) => {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
  };

  const getStatusColor = (code) => {
    if (code.isUsed) return 'bg-gray-100 text-gray-600';
    if (code.expiresAt) {
      const expiryDate = code.expiresAt.toDate ? code.expiresAt.toDate() : new Date(code.expiresAt);
      if (expiryDate < new Date()) {
        return 'bg-red-100 text-red-600';
      }
    }
    return 'bg-green-100 text-green-600';
  };

  const getStatusText = (code) => {
    if (code.isUsed) return 'Used';
    if (code.expiresAt) {
      const expiryDate = code.expiresAt.toDate ? code.expiresAt.toDate() : new Date(code.expiresAt);
      if (expiryDate < new Date()) {
        return 'Expired';
      }
    }
    return 'Active';
  };

  // Show loading or no community message
  if (!currentCommunity) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Loading community...</p>
          <p className="text-sm text-gray-400 mt-1">Please wait while we load your community information</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Visitor Management</h2>
          <p className="text-gray-600">Book visitor codes and manage access</p>
        </div>
        <button
          onClick={() => setShowBookingForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Book Visitor
        </button>
      </div>

      {/* Booking Form Modal */}
      {showBookingForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Book Visitor Code</h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Visitor Name *
                  </label>
                  <input
                    type="text"
                    name="visitorName"
                    value={formData.visitorName}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Visitor Phone *
                  </label>
                  <input
                    type="tel"
                    name="visitorPhone"
                    value={formData.visitorPhone}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="+234..."
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Visit Date *
                    </label>
                    <input
                      type="date"
                      name="visitDate"
                      value={formData.visitDate}
                      onChange={handleInputChange}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Visit Time *
                    </label>
                    <input
                      type="time"
                      name="visitTime"
                      value={formData.visitTime}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Purpose of Visit
                  </label>
                  <select
                    name="purpose"
                    value={formData.purpose}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select purpose</option>
                    <option value="personal">Personal Visit</option>
                    <option value="business">Business</option>
                    <option value="delivery">Delivery</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Additional Notes
                  </label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Any special instructions..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowBookingForm(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    {loading ? 'Creating...' : 'Create Code'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Visitor Codes List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Recent Visitor Codes</h3>
        </div>

        {loading ? (
          <div className="p-6 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
          </div>
        ) : visitorCodes.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No visitor codes yet</p>
            <p className="text-sm">Create your first visitor code to get started</p>
          </div>
        ) : (
          <div className="divide-y">
            {visitorCodes.map((code) => (
              <div key={code.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <h4 className="font-semibold text-gray-900">{code.visitorName}</h4>
                      <span className={`ml-3 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(code)}`}>
                        {getStatusText(code)}
                      </span>
                    </div>
                    
                    <div className="space-y-1 text-sm text-gray-600">
                      <div className="flex items-center">
                        <Phone className="w-4 h-4 mr-2" />
                        {code.visitorPhone}
                      </div>
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-2" />
                        {formatDate(code.visitDate)}
                      </div>
                      {code.purpose && (
                        <div className="flex items-center">
                          <MessageCircle className="w-4 h-4 mr-2" />
                          {code.purpose}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="ml-4 text-right">
                    <div className="text-2xl font-bold text-blue-600 mb-1">{code.code}</div>
                    <div className="text-xs text-gray-500">
                      {code.isUsed ? 'Used' : code.expiresAt ? 'Valid until ' + formatDate(code.expiresAt) : 'No expiry set'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VisitorBooking;
