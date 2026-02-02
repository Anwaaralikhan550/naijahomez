'use client';

/**
 * Real-time Manager using Server-Sent Events (SSE)
 * Optimized for Vercel deployment - no WebSocket dependencies
 */
class RealtimeManager {
  constructor() {
    this.connections = new Map();
    this.listeners = new Map();
    this.reconnectAttempts = new Map();
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start with 1 second
  }

  /**
   * Connect to Server-Sent Events for a specific community
   */
  connect(communityId, userId) {
    if (this.connections.has(communityId)) {
      return this.connections.get(communityId);
    }

    return this.connectSSE(communityId, userId);
  }

  /**
   * Connect via Server-Sent Events
   */
  connectSSE(communityId, userId) {
    const sseUrl = `/api/hub/events/${communityId}?userId=${userId}`;
    
    try {
      const eventSource = new EventSource(sseUrl);
      this.connections.set(communityId, eventSource);
      this.reconnectAttempts.set(communityId, 0);

      eventSource.onopen = () => {
        console.log(`SSE connected for community ${communityId}`);
        this.emit(communityId, 'connected');
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(communityId, data);
        } catch (error) {
          console.error('Failed to parse SSE message:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error(`SSE error for community ${communityId}:`, error);
        if (eventSource.readyState === EventSource.CLOSED) {
          this.connections.delete(communityId);
          this.emit(communityId, 'disconnected');
          this.attemptReconnect(communityId, userId);
        }
      };

      return eventSource;
    } catch (error) {
      console.error('Failed to create SSE connection:', error);
      throw error;
    }
  }

  /**
   * Disconnect from SSE for a specific community
   */
  disconnect(communityId) {
    const eventSource = this.connections.get(communityId);
    if (eventSource) {
      eventSource.close();
      this.connections.delete(communityId);
      this.listeners.delete(communityId);
      this.reconnectAttempts.delete(communityId);
    }
  }

  /**
   * Send message via HTTP (since SSE is one-way)
   */
  async send(communityId, message) {
    try {
      await fetch('/api/hub/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          communityId,
          message
        })
      });
      return true;
    } catch (error) {
      console.error('Failed to send message via HTTP:', error);
      return false;
    }
  }

  /**
   * Add event listener for SSE events
   */
  on(communityId, event, callback) {
    if (!this.listeners.has(communityId)) {
      this.listeners.set(communityId, new Map());
    }
    
    const communityListeners = this.listeners.get(communityId);
    if (!communityListeners.has(event)) {
      communityListeners.set(event, []);
    }
    
    communityListeners.get(event).push(callback);
  }

  /**
   * Remove event listener
   */
  off(communityId, event, callback) {
    const communityListeners = this.listeners.get(communityId);
    if (communityListeners && communityListeners.has(event)) {
      const callbacks = communityListeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to listeners
   */
  emit(communityId, event, data) {
    const communityListeners = this.listeners.get(communityId);
    if (communityListeners && communityListeners.has(event)) {
      communityListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in SSE event callback:', error);
        }
      });
    }
  }

  /**
   * Handle incoming SSE message
   */
  handleMessage(communityId, data) {
    const { type, payload } = data;
    
    switch (type) {
      case 'notification':
        this.emit(communityId, 'notification', payload);
        break;
      case 'message':
        this.emit(communityId, 'message', payload);
        break;
      case 'member_update':
        this.emit(communityId, 'member_update', payload);
        break;
      case 'social_post':
        this.emit(communityId, 'social_post', payload);
        break;
      case 'emergency_alert':
        this.emit(communityId, 'emergency_alert', payload);
        break;
      case 'visitor_alert':
        this.emit(communityId, 'visitor_alert', payload);
        break;
      case 'heartbeat':
        // Just acknowledge heartbeat
        break;
      default:
        console.warn('Unknown SSE message type:', type);
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  attemptReconnect(communityId, userId) {
    const attempts = this.reconnectAttempts.get(communityId) || 0;
    
    if (attempts >= this.maxReconnectAttempts) {
      console.error(`Max reconnection attempts reached for community ${communityId}`);
      this.emit(communityId, 'reconnect_failed');
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, attempts);
    this.reconnectAttempts.set(communityId, attempts + 1);

    setTimeout(() => {
      console.log(`Attempting to reconnect to community ${communityId} (attempt ${attempts + 1})`);
      this.connect(communityId, userId);
    }, delay);
  }

  /**
   * Get connection status
   */
  getStatus(communityId) {
    const eventSource = this.connections.get(communityId);
    if (!eventSource) return 'disconnected';
    
    switch (eventSource.readyState) {
      case EventSource.CONNECTING:
        return 'connecting';
      case EventSource.OPEN:
        return 'connected';
      case EventSource.CLOSED:
        return 'disconnected';
      default:
        return 'unknown';
    }
  }

  /**
   * Cleanup all connections
   */
  cleanup() {
    this.connections.forEach((eventSource) => {
      eventSource.close();
    });
    this.connections.clear();
    this.listeners.clear();
    this.reconnectAttempts.clear();
  }
}

// Create singleton instance
const realtimeManager = new RealtimeManager();

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    realtimeManager.cleanup();
  });
}

export default realtimeManager;