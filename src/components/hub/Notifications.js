'use client';
import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  BellOff, 
  Clock, 
  CheckCircle,
  Circle,
  RefreshCw,
  Filter,
  Trash2,
  MarkdownPreview
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authenticatedFetch } from '@/services/api';
import toast from 'react-hot-toast';
import { useFirestoreUpdates } from '@/hooks/useFirestoreQuery';
import { db } from '@/lib/firebase-client';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';

const Notifications = ({ communityId }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // all, unread, read

  // Create Firestore query for real-time notification updates
  const notificationsQuery = user && communityId
    ? query(
        collection(db, 'notifications'),
        where('communityId', '==', communityId),
        where('recipientId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(50)
      )
    : null;

  // Use Firestore client SDK for real-time notification updates
  const { isListening } = useFirestoreUpdates(
    notificationsQuery,
    (changes) => {
      // Handle real-time notification updates
      setNotifications(currentNotifications => {
        let updated = [...currentNotifications];
        
        changes.forEach(change => {
          if (change.type === 'added') {
            // Add new notification if it doesn't exist
            const exists = updated.some(n => n.id === change.doc.id);
            if (!exists) {
              updated.unshift(change.doc);
              // Show toast for new notification
              toast(change.doc.message || 'New notification', {
                icon: '🔔',
                duration: 4000
              });
            }
          } else if (change.type === 'modified') {
            const index = updated.findIndex(n => n.id === change.doc.id);
            if (index !== -1) {
              updated[index] = change.doc;
            }
          } else if (change.type === 'removed') {
            updated = updated.filter(n => n.id !== change.doc.id);
          }
        });
        
        return updated.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      });
    }
  );

  useEffect(() => {
    if (user && communityId) {
      loadNotifications(); // Load initial notifications
    }
  }, [user, communityId]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const response = await authenticatedFetch(`/api/hub/notifications?communityId=${communityId}&userId=${user.uid}`);
      const result = await response.json();

      if (response.ok) {
        setNotifications(result.notifications || []);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      const response = await authenticatedFetch('/api/hub/notifications', {
        method: 'POST',
        body: JSON.stringify({
          action: 'mark_read',
          notificationId
        })
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(notif =>
            notif.id === notificationId ? { ...notif, isRead: true, readAt: new Date() } : notif
          )
        );
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await authenticatedFetch('/api/hub/notifications', {
        method: 'POST',
        body: JSON.stringify({
          action: 'mark_all_read',
          userId: user.uid,
          communityId
        })
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(notif => ({ ...notif, isRead: true, readAt: new Date() }))
        );
        toast.success('✅ All notifications marked as read', {
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
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('❌ Failed to mark all as read');
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    const now = new Date();
    const diffInHours = (now - d) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      const minutes = Math.floor(diffInHours * 60);
      return `${minutes}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return d.toLocaleDateString();
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'border-l-red-500 bg-red-50';
      case 'medium': return 'border-l-yellow-500 bg-yellow-50';
      case 'low': return 'border-l-blue-500 bg-blue-50';
      default: return 'border-l-gray-500 bg-gray-50';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'emergency': return '🚨';
      case 'maintenance': return '🔧';
      case 'community': return '🏘️';
      case 'event': return '📅';
      case 'announcement': return '📢';
      default: return '📋';
    }
  };

  const filteredNotifications = notifications.filter(notif => {
    if (filter === 'unread') return !notif.isRead;
    if (filter === 'read') return notif.isRead;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <Bell className="w-6 h-6 mr-2" />
            Notifications
            {unreadCount > 0 && (
              <span className="ml-2 bg-red-500 text-white text-sm px-2 py-1 rounded-full">
                {unreadCount}
              </span>
            )}
          </h2>
          <p className="text-gray-600">Stay updated with community announcements</p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
            >
              Mark All Read
            </button>
          )}
          <button
            onClick={loadNotifications}
            disabled={loading}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center space-x-4">
        <Filter className="w-5 h-5 text-gray-400" />
        <div className="flex space-x-2">
          {['all', 'unread', 'read'].map(filterOption => (
            <button
              key={filterOption}
              onClick={() => setFilter(filterOption)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                filter === filterOption
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
              {filterOption === 'unread' && unreadCount > 0 && (
                <span className="ml-1 bg-red-500 text-white text-xs px-1 rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <BellOff className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-lg">No notifications found</p>
          <p className="text-sm">
            {filter === 'all' 
              ? 'You\'re all caught up!' 
              : `No ${filter} notifications`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`border-l-4 p-4 rounded-lg shadow-sm cursor-pointer transition hover:shadow-md ${
                notification.isRead ? 'bg-white' : getPriorityColor(notification.priority)
              }`}
              onClick={() => !notification.isRead && markAsRead(notification.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  <div className="text-2xl">{getTypeIcon(notification.type)}</div>
                  
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className={`font-semibold ${notification.isRead ? 'text-gray-700' : 'text-gray-900'}`}>
                        {notification.title}
                      </h4>
                      {!notification.isRead && (
                        <Circle className="w-3 h-3 text-blue-600 fill-current" />
                      )}
                      {notification.priority && notification.priority !== 'low' && (
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          notification.priority === 'high' 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {notification.priority.toUpperCase()}
                        </span>
                      )}
                    </div>
                    
                    <p className={`text-sm ${notification.isRead ? 'text-gray-600' : 'text-gray-800'} mb-2`}>
                      {notification.message}
                    </p>
                    
                    {notification.actionUrl && (
                      <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                        View Details →
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="text-right text-xs text-gray-500 ml-4">
                  <div className="flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {formatDate(notification.createdAt)}
                  </div>
                  {notification.isRead && notification.readAt && (
                    <div className="mt-1 flex items-center">
                      <CheckCircle className="w-3 h-3 mr-1 text-green-500" />
                      Read
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Notifications;