'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Bell, 
  X, 
  AlertTriangle, 
  Info, 
  CheckCircle,
  Zap,
  Droplets,
  Shield,
  Eye,
  Clock
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authenticatedFetch } from '@/services/api';
import toast from 'react-hot-toast';

const NotificationCenter = ({ communityId }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Load notifications
  const loadNotifications = useCallback(async () => {
    if (!communityId || !user) return;
    
    setLoading(true);
    try {
      const response = await authenticatedFetch(`/api/hub/notifications?communityId=${communityId}&userId=${user.uid}`);
      const result = await response.json();

      if (result.success) {
        const notifications = result.notifications || [];
        setNotifications(notifications);
        // Count unread notifications
        const unreadCount = notifications.filter(n => !n.isRead).length;
        setUnreadCount(unreadCount);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [communityId, user]);

  // Real-time polling for new notifications
  useEffect(() => {
    if (!communityId || !user) return;

    // Load initial notifications
    loadNotifications();

    // Set up polling for real-time updates
    const pollInterval = setInterval(() => {
      loadNotifications();
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(pollInterval);
  }, [communityId, user, loadNotifications]);

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      const response = await authenticatedFetch('/api/hub/notifications', {
        method: 'POST',
        body: JSON.stringify({
          action: 'mark_read',
          notificationId: notificationId
        }),
      });

      if (response.ok) {
        setNotifications(prev => 
          prev.map(notif => 
            notif.id === notificationId 
              ? { ...notif, isRead: true }
              : notif
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      const response = await authenticatedFetch('/api/hub/notifications', {
        method: 'POST',
        body: JSON.stringify({
          action: 'mark_all_read',
          userId: user.uid,
          communityId: communityId
        }),
      });

      if (response.ok) {
        setNotifications(prev => 
          prev.map(notif => ({ ...notif, isRead: true }))
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  // Get notification icon based on type
  const getNotificationIcon = (type, priority) => {
    const iconClass = priority === 'critical' ? 'text-red-600' : 
                      priority === 'high' ? 'text-orange-600' :
                      priority === 'medium' ? 'text-yellow-600' : 'text-blue-600';
    
    switch (type) {
      case 'emergency_alert':
        return <AlertTriangle className={`w-5 h-5 ${iconClass}`} />;
      case 'weather_alert':
        return <Droplets className={`w-5 h-5 ${iconClass}`} />;
      case 'power_status':
        return <Zap className={`w-5 h-5 ${iconClass}`} />;
      case 'security':
        return <Shield className={`w-5 h-5 ${iconClass}`} />;
      case 'community_watch':
        return <Eye className={`w-5 h-5 ${iconClass}`} />;
      case 'incident_report':
        return <AlertTriangle className={`w-5 h-5 ${iconClass}`} />;
      default:
        return <Info className={`w-5 h-5 ${iconClass}`} />;
    }
  };

  // Show browser notification for critical alerts
  useEffect(() => {
    if (!notifications.length) return;

    const criticalNotifications = notifications.filter(n => 
      n.priority === 'critical' && 
      !n.isRead && 
      new Date(n.createdAt) > new Date(Date.now() - 60000) // Last minute
    );

    criticalNotifications.forEach(notification => {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(`🚨 ${notification.title}`, {
          body: notification.message,
          icon: '/favicon.ico',
          tag: notification.id
        });
      } else if ('Notification' in window && Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification(`🚨 ${notification.title}`, {
              body: notification.message,
              icon: '/favicon.ico',
              tag: notification.id
            });
          }
        });
      }
      
      // Also show toast notification
      toast.error(`🚨 ${notification.title}`, {
        duration: 10000,
        position: 'top-right'
      });
    });
  }, [notifications]);

  if (!user || !communityId) return null;

  return (
    <div className="relative">
      {/* Notification Bell */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border z-50">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Notifications</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-sm text-blue-600 hover:text-blue-800 mt-1"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <Bell className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => {
                    if (!notification.isRead) {
                      markAsRead(notification.id);
                    }
                  }}
                  className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                    !notification.isRead ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type, notification.priority)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className={`text-sm font-medium ${!notification.isRead ? 'text-gray-900' : 'text-gray-600'}`}>
                          {notification.title}
                        </p>
                        {!notification.isRead && (
                          <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0"></div>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center space-x-2 mt-2 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>{notification.createdAt ? new Date(notification.createdAt).toLocaleString() : 'Just now'}</span>
                        {notification.priority === 'critical' && (
                          <span className="px-1 py-0.5 bg-red-100 text-red-600 rounded text-xs font-medium">
                            Critical
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="p-3 border-t border-gray-200 text-center">
              <button
                onClick={() => {
                  setIsOpen(false);
                  // Navigate to notifications page
                  window.location.href = '/dashboard/community/notifications';
                }}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-40"
        />
      )}
    </div>
  );
};

export default NotificationCenter;
