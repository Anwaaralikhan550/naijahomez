'use client';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

function normalizeDocuments(payload, dataKey) {
  if (Array.isArray(payload)) return payload;
  if (dataKey && Array.isArray(payload?.[dataKey])) return payload[dataKey];
  const candidates = ['data', 'items', 'messages', 'notifications', 'alerts', 'posts', 'conversations'];
  for (const key of candidates) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
}

async function fetchQuery(queryConfig) {
  if (!queryConfig?.apiUrl) return [];
  const response = await fetch(queryConfig.apiUrl, {
    headers: queryConfig.headers || {}
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || payload.message || 'Failed to fetch updates');
  }
  return normalizeDocuments(payload, queryConfig.dataKey);
}

function diffDocs(previousDocs, nextDocs) {
  const previous = new Map((previousDocs || []).map((doc) => [doc.id, doc]));
  const next = new Map((nextDocs || []).map((doc) => [doc.id, doc]));
  const changes = [];

  for (const doc of nextDocs || []) {
    const before = previous.get(doc.id);
    if (!before) {
      changes.push({ type: 'added', doc });
    } else if (JSON.stringify(before) !== JSON.stringify(doc)) {
      changes.push({ type: 'modified', doc });
    }
  }

  for (const doc of previousDocs || []) {
    if (!next.has(doc.id)) {
      changes.push({ type: 'removed', doc });
    }
  }

  return changes;
}

export function useFirestoreQuery(queryConfig, onUpdate, options = {}) {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const previousRef = useRef([]);
  const pollMs = Math.max(2000, Number(options.pollMs || queryConfig?.pollMs || 10000));

  useEffect(() => {
    if (!queryConfig?.apiUrl) {
      setLoading(false);
      return undefined;
    }

    if (authLoading) return undefined;
    if (queryConfig.requireAuth !== false && !user) {
      setError('Authentication required for updates');
      setLoading(false);
      return undefined;
    }

    let cancelled = false;

    const run = async () => {
      try {
        const docs = await fetchQuery(queryConfig);
        if (cancelled) return;
        const changes = diffDocs(previousRef.current, docs);
        previousRef.current = docs;
        setData(docs);
        setError(null);
        setLoading(false);
        if (changes.length && typeof onUpdate === 'function') {
          onUpdate(changes);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to fetch updates');
          setLoading(false);
        }
      }
    };

    run();
    const interval = setInterval(run, pollMs);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [queryConfig?.apiUrl, queryConfig?.dataKey, queryConfig?.requireAuth, pollMs, user, authLoading, onUpdate]);

  return { data, loading, error };
}

export function useFirestoreUpdates(queryConfig, onUpdate, options = {}) {
  const result = useFirestoreQuery(queryConfig, onUpdate, options);
  return {
    error: result.error,
    isListening: Boolean(queryConfig?.apiUrl) && !result.error
  };
}
