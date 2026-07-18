'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Plus,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Edit,
  Trash2
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authenticatedFetch } from '@/services/api';
import toast from 'react-hot-toast';

const EmergencyAlertManager = ({ communityId }) => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    alertLevel: 'high',
    actionRequired: '',
    contactInfo: {
      phone: '',
      email: ''
    },
    reference: '',
    expiresAt: ''
  });

  const alertLevels = [
    { value: 'low', label: 'Low', color: 'bg-blue-100 text-blue-800' },
    { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-800' },
    { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-800' }
  ];

  const loadAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await authenticatedFetch(`/api/hub/alerts?communityId=${communityId}`);
      const result = await response.json();

      if (response.ok) {
        setAlerts(result.alerts || []);
      }
    } catch (error) {
      console.error('Error loading alerts:', error);
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  useEffect(() => {
    if (communityId) {
      loadAlerts();
    }
  }, [communityId, loadAlerts]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('contactInfo.')) {
      const field = name.split('.')[1];
      setFormData({
        ...formData,
        contactInfo: {
          ...formData.contactInfo,
          [field]: value
        }
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.message.trim()) {
      toast.error('Title and message are required');
      return;
    }

    try {
      setLoading(true);
      const response = await authenticatedFetch('/api/hub/alerts', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create_alert',
          communityId,
          title: formData.title,
          message: formData.message,
          alertLevel: formData.alertLevel,
          actionRequired: formData.actionRequired || null,
          contactInfo: {
            phone: formData.contactInfo.phone || null,
            email: formData.contactInfo.email || null
          },
          reference: formData.reference || `ALERT-${Date.now()}`,
          expiresAt: formData.expiresAt ? new Date(formData.expiresAt) : null,
          createdBy: user.uid,
          createdByName: user.displayName || user.email
        })
      });

      const result = await response.json();

      if (response.ok) {
        toast.success('✅ Emergency alert sent successfully!', {
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

        // Reset form
        setFormData({
          title: '',
          message: '',
          alertLevel: 'high',
          actionRequired: '',
          contactInfo: { phone: '', email: '' },
          reference: '',
          expiresAt: ''
        });
        setShowCreateForm(false);
        loadAlerts();
      } else {
        throw new Error(result.error || 'Failed to send alert');
      }
    } catch (error) {
      toast.error(`❌ ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const deactivateAlert = async (alertId) => {
    if (!confirm('Are you sure you want to deactivate this alert?')) return;

    try {
      setLoading(true);
      const response = await authenticatedFetch('/api/hub/alerts', {
        method: 'POST',
        body: JSON.stringify({
          action: 'deactivate_alert',
          alertId
        })
      });

      if (response.ok) {
        toast.success('✅ Alert deactivated');
        loadAlerts();
      } else {
        throw new Error('Failed to deactivate alert');
      }
    } catch (error) {
      toast.error(`❌ ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
  };

  const getLevelColor = (level) => {
    const levelObj = alertLevels.find(l => l.value === level);
    return levelObj ? levelObj.color : 'bg-gray-100 text-gray-800';
  };

  const activeAlerts = alerts.filter(alert => alert.isActive);
  const inactiveAlerts = alerts.filter(alert => !alert.isActive);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Emergency Alert System</h3>
          <p className="text-gray-600">Send and manage emergency alerts for your community</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition flex items-center"
        >
          <AlertTriangle className="w-4 h-4 mr-2" />
          Create Alert
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-red-600">{activeAlerts.length}</div>
          <div className="text-sm text-gray-600">Active Alerts</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-gray-600">{inactiveAlerts.length}</div>
          <div className="text-sm text-gray-600">Historical Alerts</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-gray-900">{alerts.length}</div>
          <div className="text-sm text-gray-600">Total Alerts</div>
        </div>
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Emergency Alert</h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Alert Title *
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="Emergency alert title"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Alert Level *
                    </label>
                    <select
                      name="alertLevel"
                      value={formData.alertLevel}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      {alertLevels.map(level => (
                        <option key={level.value} value={level.value}>
                          {level.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reference ID
                    </label>
                    <input
                      type="text"
                      name="reference"
                      value={formData.reference}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                      placeholder="Auto-generated"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Alert Message *
                  </label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="Detailed emergency message..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Action Required
                  </label>
                  <textarea
                    name="actionRequired"
                    value={formData.actionRequired}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="What should residents do? (optional)"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Emergency Phone
                    </label>
                    <input
                      type="tel"
                      name="contactInfo.phone"
                      value={formData.contactInfo.phone}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                      placeholder="+234..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Emergency Email
                    </label>
                    <input
                      type="email"
                      name="contactInfo.email"
                      value={formData.contactInfo.email}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                      placeholder="emergency@..."
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expires At (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    name="expiresAt"
                    value={formData.expiresAt}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 transition"
                  >
                    {loading ? 'Sending...' : 'Send Alert'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Active Alerts */}
      {activeAlerts.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-red-600">Active Emergency Alerts</h4>
          {activeAlerts.map((alert) => (
            <div key={alert.id} className="bg-red-50 border border-red-200 rounded-lg p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <h5 className="font-semibold text-gray-900">{alert.title}</h5>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getLevelColor(alert.alertLevel)}`}>
                      {alert.alertLevel.toUpperCase()}
                    </span>
                  </div>
                  
                  <p className="text-gray-700 mb-3">{alert.message}</p>
                  
                  {alert.actionRequired && (
                    <div className="bg-white p-3 rounded-md mb-3">
                      <p className="text-sm font-medium text-red-800 mb-1">Action Required:</p>
                      <p className="text-sm text-red-700">{alert.actionRequired}</p>
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      {formatDate(alert.createdAt)}
                    </div>
                    {alert.reference && (
                      <div>Ref: {alert.reference}</div>
                    )}
                  </div>
                </div>
                
                <button
                  onClick={() => deactivateAlert(alert.id)}
                  className="ml-4 px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 transition"
                >
                  Deactivate
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Historical Alerts */}
      {inactiveAlerts.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h4 className="text-lg font-semibold text-gray-900">Alert History</h4>
          </div>
          <div className="divide-y">
            {inactiveAlerts.slice(0, 10).map((alert) => (
              <div key={alert.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h6 className="font-medium text-gray-900">{alert.title}</h6>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full opacity-75 ${getLevelColor(alert.alertLevel)}`}>
                        {alert.alertLevel.toUpperCase()}
                      </span>
                      <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                        RESOLVED
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm">{alert.message}</p>
                  </div>
                  <div className="text-right text-xs text-gray-500 ml-4">
                    <div>{formatDate(alert.createdAt)}</div>
                    {alert.deactivatedAt && (
                      <div>Resolved: {formatDate(alert.deactivatedAt)}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {alerts.length === 0 && !loading && (
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">No emergency alerts sent yet</p>
          <p className="text-sm text-gray-400 mt-1">Create your first alert to get started</p>
        </div>
      )}
    </div>
  );
};

export default EmergencyAlertManager;
