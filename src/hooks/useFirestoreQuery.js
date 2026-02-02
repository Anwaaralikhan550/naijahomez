'use client';
import { useState, useEffect, useRef } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';

/**
 * Custom hook for Firestore real-time queries with authentication checks and retry limits
 * This replaces polling with Firebase client SDK listeners
 * 
 * @param {Query} query - Firestore query object
 * @param {Function} onUpdate - Optional callback for updates
 * @param {Object} options - Options for retry behavior
 * @returns {Object} - { data, loading, error }
 */
export function useFirestoreQuery(query, onUpdate, options = {}) {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const unsubscribeRef = useRef(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef(null);
  
  // Retry configuration
  const maxRetries = options.maxRetries || 3;
  const baseDelay = options.baseDelay || 1000; // 1 second
  const maxDelay = options.maxDelay || 10000; // 10 seconds

  const clearRetryTimeout = () => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  };

  const setupListener = () => {
    if (!query) {
      setLoading(false);
      return;
    }

    // Don't set up listener if user is not authenticated
    if (authLoading) {
      console.log('Firestore listener: Waiting for auth...');
      return;
    }

    if (!user) {
      console.log('Firestore listener: No authenticated user, skipping listener setup');
      setError('Authentication required for real-time updates');
      setLoading(false);
      return;
    }

    console.log('Setting up Firestore listener for authenticated user');
    setLoading(true);
    setError(null);

    try {
      unsubscribeRef.current = onSnapshot(
        query,
        (snapshot) => {
          // Reset retry count on successful connection
          retryCountRef.current = 0;
          clearRetryTimeout();
          
          console.log(`Firestore update: ${snapshot.docChanges().length} changes`);
          
          const documents = [];
          snapshot.forEach((doc) => {
            documents.push({
              id: doc.id,
              ...doc.data(),
              // Convert Firestore timestamps to ISO strings
              createdAt: doc.data().createdAt?.toDate?.().toISOString() || doc.data().createdAt,
              updatedAt: doc.data().updatedAt?.toDate?.().toISOString() || doc.data().updatedAt
            });
          });
          
          setData(documents);
          setLoading(false);
          
          // Call custom update handler if provided
          if (onUpdate && snapshot.docChanges().length > 0) {
            const changes = snapshot.docChanges().map(change => ({
              type: change.type,
              doc: {
                id: change.doc.id,
                ...change.doc.data(),
                createdAt: change.doc.data().createdAt?.toDate?.().toISOString() || change.doc.data().createdAt,
                updatedAt: change.doc.data().updatedAt?.toDate?.().toISOString() || change.doc.data().updatedAt
              }
            }));
            onUpdate(changes);
          }
        },
        (err) => {
          console.error('Firestore listener error:', err);
          
          // Check if it's a permission error
          const isPermissionError = err.code === 'permission-denied' || err.message.includes('Missing or insufficient permissions');
          
          if (isPermissionError) {
            console.warn('Firestore permission error - stopping retry attempts to prevent loops');
            setError(`Permission denied: ${err.message}`);
            setLoading(false);
            return; // Don't retry permission errors to prevent loops
          }
          
          // For other errors, implement exponential backoff retry
          if (retryCountRef.current < maxRetries) {
            const delay = Math.min(baseDelay * Math.pow(2, retryCountRef.current), maxDelay);
            retryCountRef.current++;
            
            console.log(`Firestore listener error, retrying in ${delay}ms (attempt ${retryCountRef.current}/${maxRetries})`);
            
            retryTimeoutRef.current = setTimeout(() => {
              // Clean up current listener before retry
              if (unsubscribeRef.current) {
                unsubscribeRef.current();
                unsubscribeRef.current = null;
              }
              setupListener();
            }, delay);
          } else {
            console.error('Firestore listener max retries exceeded');
            setError(`Connection failed after ${maxRetries} attempts: ${err.message}`);
            setLoading(false);
          }
        }
      );
    } catch (err) {
      console.error('Error setting up Firestore listener:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    setupListener();

    // Cleanup function
    return () => {
      clearRetryTimeout();
      if (unsubscribeRef.current) {
        console.log('Cleaning up Firestore listener');
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [query, onUpdate, user, authLoading]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  return {
    data,
    loading,
    error
  };
}

/**
 * Hook specifically for real-time updates only (no initial data load) with authentication checks
 * Useful when you load initial data separately but want real-time updates
 */
export function useFirestoreUpdates(query, onUpdate, options = {}) {
  const { user, loading: authLoading } = useAuth();
  const unsubscribeRef = useRef(null);
  const [error, setError] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef(null);
  
  // Retry configuration
  const maxRetries = options.maxRetries || 3;
  const baseDelay = options.baseDelay || 1000; // 1 second
  const maxDelay = options.maxDelay || 10000; // 10 seconds

  const clearRetryTimeout = () => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  };

  const setupListener = () => {
    if (!query || !onUpdate) {
      setIsListening(false);
      return;
    }

    // Don't set up listener if user is not authenticated
    if (authLoading) {
      console.log('Firestore updates listener: Waiting for auth...');
      return;
    }

    if (!user) {
      console.log('Firestore updates listener: No authenticated user, skipping listener setup');
      setError('Authentication required for real-time updates');
      setIsListening(false);
      return;
    }

    console.log('Setting up Firestore updates listener for authenticated user');
    setIsListening(true);
    setError(null);

    try {
      unsubscribeRef.current = onSnapshot(
        query,
        (snapshot) => {
          // Reset retry count on successful connection
          retryCountRef.current = 0;
          clearRetryTimeout();
          
          const changes = snapshot.docChanges();
          if (changes.length > 0) {
            console.log(`Firestore updates: ${changes.length} changes`);
            
            const changesDocs = changes.map(change => ({
              type: change.type,
              doc: {
                id: change.doc.id,
                ...change.doc.data(),
                createdAt: change.doc.data().createdAt?.toDate?.().toISOString() || change.doc.data().createdAt,
                updatedAt: change.doc.data().updatedAt?.toDate?.().toISOString() || change.doc.data().updatedAt
              }
            }));
            
            onUpdate(changesDocs);
          }
        },
        (err) => {
          console.error('Firestore updates listener error:', err);
          
          // Check if it's a permission error
          const isPermissionError = err.code === 'permission-denied' || err.message.includes('Missing or insufficient permissions');
          
          if (isPermissionError) {
            console.warn('Firestore permission error - stopping retry attempts to prevent loops');
            setError(`Permission denied: ${err.message}`);
            setIsListening(false);
            return; // Don't retry permission errors to prevent loops
          }
          
          // For other errors, implement exponential backoff retry
          if (retryCountRef.current < maxRetries) {
            const delay = Math.min(baseDelay * Math.pow(2, retryCountRef.current), maxDelay);
            retryCountRef.current++;
            
            console.log(`Firestore updates listener error, retrying in ${delay}ms (attempt ${retryCountRef.current}/${maxRetries})`);
            
            retryTimeoutRef.current = setTimeout(() => {
              // Clean up current listener before retry
              if (unsubscribeRef.current) {
                unsubscribeRef.current();
                unsubscribeRef.current = null;
              }
              setupListener();
            }, delay);
          } else {
            console.error('Firestore updates listener max retries exceeded');
            setError(`Connection failed after ${maxRetries} attempts: ${err.message}`);
            setIsListening(false);
          }
        }
      );
    } catch (err) {
      console.error('Error setting up Firestore updates listener:', err);
      setError(err.message);
      setIsListening(false);
    }
  };

  useEffect(() => {
    setupListener();

    return () => {
      clearRetryTimeout();
      if (unsubscribeRef.current) {
        console.log('Cleaning up Firestore updates listener');
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [query, onUpdate, user, authLoading]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearRetryTimeout();
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  return {
    isListening,
    error
  };
}