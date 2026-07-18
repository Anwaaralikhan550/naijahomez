'use client';
import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  X, 
  Check, 
  AlertCircle, 
  MessageCircle, 
  Users, 
  Shield,
  Volume2,
  VolumeX
} from 'lucide-react';
import { useRealtimeNotifications } from '@/hooks/useRealtime';
import toast from 'react-hot-toast';

const RealtimeNotifications = ({ communityId, userId, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    clearNotifications 
  } = useRealtimeNotifications(communityId, userId);

  // Request notification permissions on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Play notification sound for new notifications
  useEffect(() => {
    if (notifications.length > 0 && soundEnabled) {
      const latestNotification = notifications[0];
      if (!latestNotification.read) {
        playNotificationSound(latestNotification.type);
      }
    }
  }, [notifications, soundEnabled]);

  const playNotificationSound = (type) => {
    try {
      const soundFile = type === 'emergency' ? 'notification-error.mp3' : 'notification-success.mp3';
      const audio = new Audio(`/${soundFile}`);
      audio.volume = 0.5;
      audio.play().catch(() => {
        // Ignore if audio fails to play
      });
    } catch (error) {
      // Ignore audio errors
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'message':
        return <MessageCircle className="w-4 h-4 text-blue-600" />;
      case 'member':
        return <Users className="w-4 h-4 text-green-600" />;
      case 'emergency':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'admin':
        return <Shield className="w-4 h-4 text-purple-600" />;
      default:
        return <Bell className="w-4 h-4 text-gray-600" />;
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'message':
        return 'border-l-blue-500';
      case 'member':
        return 'border-l-green-500';
      case 'emergency':
        return 'border-l-red-500';
      case 'admin':
        return 'border-l-purple-500';
      default:
        return 'border-l-gray-500';
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  const normalizeActionUrl = (actionUrl) => {
    if (!actionUrl) return null;

    if (typeof actionUrl === 'string') {
      const trimmed = actionUrl.trim();
      return trimmed.length > 0 ? trimmed : null;
    }

    if (typeof actionUrl === 'object') {
      if (typeof actionUrl.pathname === 'string') {
        const query = actionUrl.query && typeof actionUrl.query === 'object'
          ? `?${new URLSearchParams(
              Object.entries(actionUrl.query).reduce((acc, [key, value]) => {
                acc[key] = value == null ? '' : String(value);
                return acc;
              }, {})
            ).toString()}`
          : '';
        return `${actionUrl.pathname}${query}`;
      }

      if (typeof actionUrl.url === 'string') {
        return actionUrl.url;
      }
    }

    return null;
  };

  const handleNotificationClick = (notification) => {
    markAsRead(notification.id);
    
    // Handle notification action based on type
    const safeUrl = normalizeActionUrl(notification.actionUrl);
    if (safeUrl) {
      window.location.href = safeUrl;
      return;
    }

    if (notification.actionUrl != null) {
      console.warn('Skipped invalid notification actionUrl:', notification.actionUrl);
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40 bg-black bg-opacity-25 lg:hidden"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Panel */}
          <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
              <div className="flex items-center gap-2">
                {/* Sound Toggle */}
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className="p-1 text-gray-500 hover:text-gray-700 rounded"
                  title={soundEnabled ? 'Disable sound' : 'Enable sound'}
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
                
                {/* Mark All Read */}
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-sm text-blue-600 hover:text-blue-700 px-2 py-1 rounded"
                    title="Mark all as read"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
                
                {/* Close */}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-gray-500 hover:text-gray-700 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                  <Bell className="w-8 h-8 mb-2" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-gray-50 cursor-pointer border-l-4 ${getNotificationColor(notification.type)} ${
                        notification.read ? 'opacity-60' : ''
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900 line-clamp-1">
                                {notification.title}
                              </p>
                              <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                                {notification.message}
                              </p>
                            </div>
                            {!notification.read && (
                              <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 ml-2 mt-1" />
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-gray-500">
                              {formatTimestamp(notification.createdAt)}
                            </span>
                            {!notification.read && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markAsRead(notification.id);
                                }}
                                className="text-xs text-blue-600 hover:text-blue-700"
                              >
                                Mark read
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="border-t border-gray-200 p-3">
                <button
                  onClick={clearNotifications}
                  className="w-full text-sm text-gray-600 hover:text-gray-800 py-2"
                >
                  Clear all notifications
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default RealtimeNotifications;
