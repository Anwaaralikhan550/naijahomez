'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import realtimeManager from '@/lib/realtimeManager';

/**
 * Hook for managing SSE real-time connections
 */
export const useRealtime = (communityId, userId) => {
  const [status, setStatus] = useState('disconnected');
  const [lastMessage, setLastMessage] = useState(null);
  const eventListenersRef = useRef(new Map());

  // Connect/disconnect based on communityId and userId
  useEffect(() => {
    if (!communityId || !userId) return;

    // Connect to SSE
    realtimeManager.connect(communityId, userId);

    // Set up status listeners
    const handleConnected = () => setStatus('connected');
    const handleDisconnected = () => setStatus('disconnected');
    const handleError = () => setStatus('error');

    realtimeManager.on(communityId, 'connected', handleConnected);
    realtimeManager.on(communityId, 'disconnected', handleDisconnected);
    realtimeManager.on(communityId, 'error', handleError);

    // Clean up on unmount
    return () => {
      realtimeManager.off(communityId, 'connected', handleConnected);
      realtimeManager.off(communityId, 'disconnected', handleDisconnected);
      realtimeManager.off(communityId, 'error', handleError);
      
      // Clean up all event listeners for this hook
      eventListenersRef.current.forEach((callback, event) => {
        realtimeManager.off(communityId, event, callback);
      });
      eventListenersRef.current.clear();
      
      realtimeManager.disconnect(communityId);
    };
  }, [communityId, userId]);

  // Send message function (via HTTP)
  const sendMessage = useCallback((message) => {
    if (communityId) {
      return realtimeManager.send(communityId, message);
    }
    return false;
  }, [communityId]);

  // Add event listener function
  const addEventListener = useCallback((event, callback) => {
    if (communityId) {
      realtimeManager.on(communityId, event, callback);
      eventListenersRef.current.set(event, callback);
    }
  }, [communityId]);

  // Remove event listener function
  const removeEventListener = useCallback((event, callback) => {
    if (communityId) {
      realtimeManager.off(communityId, event, callback);
      eventListenersRef.current.delete(event);
    }
  }, [communityId]);

  return {
    status,
    lastMessage,
    sendMessage,
    addEventListener,
    removeEventListener
  };
};

/**
 * Hook for real-time notifications
 */
export const useRealtimeNotifications = (communityId, userId) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!communityId || !userId) return;

    realtimeManager.connect(communityId, userId);

    const handleNotification = (notification) => {
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
      
      // Show browser notification if permission granted
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message,
          icon: '/favicon.ico',
          tag: notification.id
        });
      }

      // Play notification sound
      try {
        const audio = new Audio('/notification-success.mp3');
        audio.volume = 0.3;
        audio.play().catch(() => {});
      } catch (error) {
        // Ignore audio errors
      }
    };

    realtimeManager.on(communityId, 'notification', handleNotification);

    return () => {
      realtimeManager.off(communityId, 'notification', handleNotification);
    };
  }, [communityId, userId]);

  const markAsRead = useCallback((notificationId) => {
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotifications
  };
};

/**
 * Hook for real-time emergency alerts
 */
export const useRealtimeAlerts = (communityId, userId) => {
  const [alerts, setAlerts] = useState([]);
  const [activeAlerts, setActiveAlerts] = useState([]);

  useEffect(() => {
    if (!communityId || !userId) return;

    realtimeManager.connect(communityId, userId);

    const handleEmergencyAlert = (alert) => {
      setAlerts(prev => [alert, ...prev]);
      
      if (alert.isActive) {
        setActiveAlerts(prev => [alert, ...prev]);
        
        // Show urgent browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`🚨 EMERGENCY ALERT: ${alert.title}`, {
            body: alert.message,
            icon: '/favicon.ico',
            tag: alert.id,
            requireInteraction: true
          });
        }
        
        // Play urgent notification sound
        try {
          const audio = new Audio('/notification-error.mp3');
          audio.volume = 0.8;
          audio.play().catch(() => {});
        } catch (error) {
          // Ignore audio errors
        }
      } else {
        // Remove from active alerts if deactivated
        setActiveAlerts(prev => prev.filter(a => a.id !== alert.id));
      }
    };

    realtimeManager.on(communityId, 'emergency_alert', handleEmergencyAlert);

    return () => {
      realtimeManager.off(communityId, 'emergency_alert', handleEmergencyAlert);
    };
  }, [communityId, userId]);

  return {
    alerts,
    activeAlerts
  };
};

/**
 * Hook for real-time chat updates (for immediate UI updates)
 */
export const useRealtimeChat = (communityId, userId, channel = 'general') => {
  const [newMessages, setNewMessages] = useState([]);
  const [messageCount, setMessageCount] = useState(0);

  useEffect(() => {
    if (!communityId || !userId) return;

    realtimeManager.connect(communityId, userId);

    const handleMessage = (message) => {
      // Only handle messages for the current channel
      if (message.channel === channel) {
        setNewMessages(prev => [message, ...prev.slice(0, 4)]); // Keep last 5
        setMessageCount(prev => prev + 1);
      }
    };

    realtimeManager.on(communityId, 'message', handleMessage);

    return () => {
      realtimeManager.off(communityId, 'message', handleMessage);
    };
  }, [communityId, userId, channel]);

  const clearNewMessages = useCallback(() => {
    setNewMessages([]);
    setMessageCount(0);
  }, []);

  return {
    newMessages,
    messageCount,
    clearNewMessages
  };
};

export default {
  useRealtime,
  useRealtimeNotifications,
  useRealtimeAlerts,
  useRealtimeChat
};