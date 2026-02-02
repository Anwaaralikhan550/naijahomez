'use client';
import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for Firestore real-time updates via SSE
 * This replaces polling with server-side Firestore listeners
 * 
 * @param {string} endpoint - The SSE endpoint URL
 * @param {Object} params - Query parameters for the endpoint
 * @param {Function} onUpdate - Callback when data updates
 * @returns {Object} - { data, loading, error, connectionStatus }
 */
export function useFirestoreSSE(endpoint, params = {}, onUpdate) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [eventSource, setEventSource] = useState(null);

  const connect = useCallback(() => {
    if (!endpoint) return;

    // Build query string
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;

    console.log('Connecting to SSE:', url);
    setConnectionStatus('connecting');
    
    const es = new EventSource(url);
    
    es.onopen = () => {
      console.log('SSE connection opened');
      setConnectionStatus('connected');
      setError(null);
    };
    
    es.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'connected') {
          console.log('SSE connected:', message.message);
          setLoading(false);
        } else if (message.type === 'initial') {
          // Initial data load
          setData(message.data || []);
          setLoading(false);
        } else if (message.type === 'update') {
          // Real-time update
          if (onUpdate) {
            onUpdate(message.changes);
          } else {
            // Default update handling
            setData(currentData => {
              let updatedData = [...currentData];
              
              message.changes.forEach(change => {
                if (change.type === 'added') {
                  updatedData.push(change.doc);
                } else if (change.type === 'modified') {
                  const index = updatedData.findIndex(item => item.id === change.doc.id);
                  if (index !== -1) {
                    updatedData[index] = change.doc;
                  }
                } else if (change.type === 'removed') {
                  updatedData = updatedData.filter(item => item.id !== change.doc.id);
                }
              });
              
              return updatedData;
            });
          }
        } else if (message.type === 'error') {
          console.error('SSE error:', message.message);
          setError(message.message);
        }
      } catch (err) {
        console.error('Error parsing SSE data:', err);
        setError('Failed to parse server data');
      }
    };
    
    es.onerror = (err) => {
      console.error('SSE connection error:', err);
      setConnectionStatus('error');
      setError('Connection lost. Reconnecting...');
      
      // Auto-reconnect after 5 seconds
      setTimeout(() => {
        if (es.readyState === EventSource.CLOSED) {
          console.log('Attempting to reconnect SSE...');
          connect();
        }
      }, 5000);
    };
    
    setEventSource(es);
    
    return es;
  }, [endpoint, params, onUpdate]);

  useEffect(() => {
    const es = connect();
    
    // Cleanup on unmount
    return () => {
      if (es) {
        console.log('Closing SSE connection');
        es.close();
      }
    };
  }, [connect]);

  const refresh = useCallback(() => {
    if (eventSource) {
      eventSource.close();
    }
    connect();
  }, [eventSource, connect]);

  return {
    data,
    loading,
    error,
    connectionStatus,
    refresh
  };
}