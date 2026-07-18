'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Send, 
  Users, 
  User, 
  Bell, 
  MessageCircle,
  AlertCircle,
  CheckCircle,
  Calendar,
  Eye,
  Trash2,
  Plus,
  Filter
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authenticatedFetch } from '@/services/api';
import toast from 'react-hot-toast';

const NotificationSender = ({ communityId }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('send');
  const [members, setMembers] = useState([]);
  const [sentNotifications, setSentNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'announcement',
    priority: 'medium',
    recipients: 'all', // 'all', 'specific', 'role'
    selectedMembers: [],
    selectedRole: 'member',
    actionUrl: '',
    expiresAt: ''
  });

  const notificationTypes = [
    { value: 'announcement', label: 'Announcement', icon: '📢' },
    { value: 'maintenance', label: 'Maintenance', icon: '🔧' },
    { value: 'community', label: 'Community Event', icon: '🏘️' },
    { value: 'emergency', label: 'Emergency', icon: '🚨' },
    { value: 'general', label: 'General', icon: '📋' }
  ];

  const priorityLevels = [
    { value: 'low', label: 'Low', color: 'text-green-600' },
    { value: 'medium', label: 'Medium', color: 'text-yellow-600' },
    { value: 'high', label: 'High', color: 'text-red-600' }
  ];

  const loadMembers = useCallback(async () => {
    try {
      const response = await authenticatedFetch(`/api/hub/admin/members?communityId=${communityId}`);
      const result = await response.json();

      if (response.ok) {
        setMembers(result.members || []);
      }
    } catch (error) {
      console.error('Error loading members:', error);
    }
  }, [communityId]);

  const loadSentNotifications = useCallback(async () => {
    try {
      const response = await authenticatedFetch(`/api/hub/notifications?communityId=${communityId}&admin=true`);
      const result = await response.json();

      if (response.ok) {
        setSentNotifications(result.notifications || []);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  }, [communityId]);

  useEffect(() => {
    if (communityId) {
      loadMembers();
      loadSentNotifications();
    }
  }, [communityId, loadMembers, loadSentNotifications]);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleMemberSelect = (memberId) => {
    const selectedMembers = formData.selectedMembers.includes(memberId)
      ? formData.selectedMembers.filter(id => id !== memberId)
      : [...formData.selectedMembers, memberId];
    
    setFormData({
      ...formData,
      selectedMembers
    });
  };

  const getRecipientsList = () => {
    if (formData.recipients === 'all') {
      return members.map(member => member.userId);
    } else if (formData.recipients === 'role') {
      return members
        .filter(member => member.role === formData.selectedRole)
        .map(member => member.userId);
    } else if (formData.recipients === 'specific') {
      return formData.selectedMembers;
    }
    return [];
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.message.trim()) {
      toast.error('Title and message are required');
      return;
    }

    const recipients = getRecipientsList();
    if (recipients.length === 0) {
      toast.error('Please select at least one recipient');
      return;
    }

    try {
      setLoading(true);
      const response = await authenticatedFetch('/api/hub/notifications', {
        method: 'POST',
        body: JSON.stringify({
          action: 'send_notification',
          communityId,
          title: formData.title,
          message: formData.message,
          type: formData.type,
          priority: formData.priority,
          recipients,
          actionUrl: formData.actionUrl || null,
          expiresAt: formData.expiresAt ? new Date(formData.expiresAt) : null,
          senderName: user.displayName || user.email,
          senderId: user.uid
        })
      });

      const result = await response.json();

      if (response.ok) {
        toast.success('✅ Notification sent successfully!', {
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

        // Reset form
        setFormData({
          title: '',
          message: '',
          type: 'announcement',
          priority: 'medium',
          recipients: 'all',
          selectedMembers: [],
          selectedRole: 'member',
          actionUrl: '',
          expiresAt: ''
        });

        loadSentNotifications();
      } else {
        throw new Error(result.error || 'Failed to send notification');
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

  const getTypeIcon = (type) => {
    const typeObj = notificationTypes.find(t => t.value === type);
    return typeObj ? typeObj.icon : '📋';
  };

  const getPriorityColor = (priority) => {
    const priorityObj = priorityLevels.find(p => p.value === priority);
    return priorityObj ? priorityObj.color : 'text-gray-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Community Notifications</h3>
          <p className="text-gray-600">Send notifications to community members</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('send')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'send'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Send className="w-4 h-4 inline mr-2" />
            Send Notification
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'history'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Bell className="w-4 h-4 inline mr-2" />
            Sent Notifications ({sentNotifications.length})
          </button>
        </nav>
      </div>

      {/* Send Notification Tab */}
      {activeTab === 'send' && (
        <div className="bg-white rounded-lg shadow p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notification Title *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter notification title"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {notificationTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.icon} {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {priorityLevels.map(priority => (
                    <option key={priority.value} value={priority.value}>
                      {priority.label}
                    </option>
                  ))}
                </select>
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message *
              </label>
              <textarea
                name="message"
                value={formData.message}
                onChange={handleInputChange}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your notification message..."
                required
              />
            </div>

            {/* Action URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Action URL (Optional)
              </label>
              <input
                type="url"
                name="actionUrl"
                value={formData.actionUrl}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://example.com/action"
              />
            </div>

            {/* Recipients */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Recipients
              </label>
              
              <div className="space-y-4">
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="recipients"
                      value="all"
                      checked={formData.recipients === 'all'}
                      onChange={handleInputChange}
                      className="mr-2"
                    />
                    <Users className="w-4 h-4 mr-1" />
                    All Members ({members.length})
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="recipients"
                      value="role"
                      checked={formData.recipients === 'role'}
                      onChange={handleInputChange}
                      className="mr-2"
                    />
                    <User className="w-4 h-4 mr-1" />
                    By Role
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="recipients"
                      value="specific"
                      checked={formData.recipients === 'specific'}
                      onChange={handleInputChange}
                      className="mr-2"
                    />
                    <User className="w-4 h-4 mr-1" />
                    Specific Members
                  </label>
                </div>

                {formData.recipients === 'role' && (
                  <div>
                    <select
                      name="selectedRole"
                      value={formData.selectedRole}
                      onChange={handleInputChange}
                      className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="member">Members ({members.filter(m => m.role === 'member').length})</option>
                      <option value="moderator">Moderators ({members.filter(m => m.role === 'moderator').length})</option>
                      <option value="admin">Admins ({members.filter(m => m.role === 'admin').length})</option>
                    </select>
                  </div>
                )}

                {formData.recipients === 'specific' && (
                  <div className="border border-gray-300 rounded-lg p-4 max-h-60 overflow-y-auto">
                    <div className="space-y-2">
                      {members.map(member => (
                        <label key={member.id} className="flex items-center p-2 hover:bg-gray-50 rounded">
                          <input
                            type="checkbox"
                            checked={formData.selectedMembers.includes(member.userId)}
                            onChange={() => handleMemberSelect(member.userId)}
                            className="mr-3"
                          />
                          <div className="flex-1">
                            <div className="font-medium">{member.userName}</div>
                            <div className="text-sm text-gray-500">{member.userEmail}</div>
                          </div>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            member.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                            member.role === 'moderator' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {member.role}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Submit */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition flex items-center"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Send Notification
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Notification History Tab */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h4 className="text-lg font-semibold text-gray-900">Sent Notifications</h4>
          </div>

          {sentNotifications.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No notifications sent yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {sentNotifications.map((notification) => (
                <div key={notification.id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="text-2xl">{getTypeIcon(notification.type)}</span>
                        <h5 className="font-medium text-gray-900">{notification.title}</h5>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          notification.priority === 'high' ? 'bg-red-100 text-red-800' :
                          notification.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {notification.priority}
                        </span>
                      </div>
                      
                      <p className="text-gray-600 mb-3">{notification.message}</p>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          {formatDate(notification.createdAt)}
                        </div>
                        <div className="flex items-center">
                          <Users className="w-4 h-4 mr-1" />
                          {notification.recipients?.length || 0} recipients
                        </div>
                        {notification.senderName && (
                          <div>
                            By: {notification.senderName}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationSender;
