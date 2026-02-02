import { useState, useEffect, useCallback } from 'react';

// Simple client-side cache hook
export function useApiCache(key, fetcher, options = {}) {
  const {
    ttl = 300000, // 5 minutes default
    enabled = true,
    dependencies = []
  } = options;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Get cache key with dependencies
  const cacheKey = `${key}-${JSON.stringify(dependencies)}`;

  const fetchData = useCallback(async () => {
    if (!enabled || !fetcher) return;

    // Check localStorage cache first
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { data: cachedData, timestamp } = JSON.parse(cached);
        const isStale = Date.now() - timestamp > ttl;
        
        if (!isStale) {
          setData(cachedData);
          return cachedData;
        }
      }
    } catch (e) {
      // Ignore cache errors
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetcher();
      setData(result);

      // Cache the result
      try {
        localStorage.setItem(cacheKey, JSON.stringify({
          data: result,
          timestamp: Date.now()
        }));
      } catch (e) {
        // Ignore storage errors (quota exceeded, etc.)
      }

      return result;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [cacheKey, fetcher, enabled, ttl]);

  const invalidate = useCallback(() => {
    try {
      localStorage.removeItem(cacheKey);
    } catch (e) {
      // Ignore
    }
    setData(null);
    setError(null);
  }, [cacheKey]);

  const refetch = useCallback(async () => {
    invalidate();
    return fetchData();
  }, [fetchData, invalidate]);

  useEffect(() => {
    if (enabled) {
      fetchData();
    }
  }, [fetchData, enabled]);

  return {
    data,
    loading,
    error,
    refetch,
    invalidate
  };
}

// Specialized hooks for common API calls
export function useProperties(params = {}, options = {}) {
  const fetcher = useCallback(
    () => import('@/services/api').then(({ default: api }) => api.getProperties(params)),
    [JSON.stringify(params)]
  );

  return useApiCache(
    'properties',
    fetcher,
    {
      ...options,
      dependencies: [params]
    }
  );
}

export function useProperty(slug, options = {}) {
  const fetcher = useCallback(
    () => import('@/services/api').then(({ default: api }) => api.getPropertyBySlug(slug)),
    [slug]
  );

  return useApiCache(
    `property-${slug}`,
    slug ? fetcher : null,
    {
      ...options,
      enabled: !!slug && options.enabled !== false
    }
  );
}

export function useFeaturedProperties(count = 4, options = {}) {
  const fetcher = useCallback(
    () => import('@/services/api').then(({ default: api }) => api.getFeaturedProperties(count)),
    [count]
  );

  return useApiCache(
    `featured-properties-${count}`,
    fetcher,
    {
      ttl: 600000, // 10 minutes for featured content
      ...options
    }
  );
}

// Marketplace hooks
export function useMarketplaceItems(params = {}, options = {}) {
  const fetcher = useCallback(
    () => import('@/services/api').then(({ default: api }) => api.getMarketplaceItems(params)),
    [JSON.stringify(params)]
  );

  return useApiCache(
    'marketplace',
    fetcher,
    {
      ...options,
      dependencies: [params]
    }
  );
}

export function useMarketplaceItem(slug, options = {}) {
  const fetcher = useCallback(
    () => import('@/services/api').then(({ default: api }) => api.getMarketplaceItemBySlug(slug)),
    [slug]
  );

  return useApiCache(
    `marketplace-${slug}`,
    slug ? fetcher : null,
    {
      ...options,
      enabled: !!slug && options.enabled !== false
    }
  );
}

// Tradespeople hooks
export function useTradespeople(params = {}, options = {}) {
  const fetcher = useCallback(
    () => import('@/services/api').then(({ default: api }) => api.getTradespeople(params)),
    [JSON.stringify(params)]
  );

  return useApiCache(
    'tradespeople',
    fetcher,
    {
      ...options,
      dependencies: [params]
    }
  );
}

export function useFeaturedTradespeople(count = 4, options = {}) {
  const fetcher = useCallback(
    () => import('@/services/api').then(({ default: api }) => api.getFeaturedTradespeople(count)),
    [count]
  );

  return useApiCache(
    `featured-tradespeople-${count}`,
    fetcher,
    {
      ttl: 600000, // 10 minutes for featured content
      ...options
    }
  );
}

export function useService(slug, options = {}) {
  const fetcher = useCallback(
    () => import('@/services/api').then(({ default: api }) => api.getServiceBySlug(slug)),
    [slug]
  );

  return useApiCache(
    `service-${slug}`,
    slug ? fetcher : null,
    {
      ...options,
      enabled: !!slug && options.enabled !== false
    }
  );
}

// Housemates hooks
export function useHousemates(params = {}, options = {}) {
  const fetcher = useCallback(
    () => import('@/services/api').then(({ default: api }) => api.getHousemates(params)),
    [JSON.stringify(params)]
  );

  return useApiCache(
    'housemates',
    fetcher,
    {
      ...options,
      dependencies: [params]
    }
  );
}

export function useHousemate(slug, options = {}) {
  const fetcher = useCallback(
    () => import('@/services/api').then(({ default: api }) => api.getHousemateBySlug(slug)),
    [slug]
  );

  return useApiCache(
    `housemate-${slug}`,
    slug ? fetcher : null,
    {
      ...options,
      enabled: !!slug && options.enabled !== false
    }
  );
}

// Noticeboard hooks
export function useNotices(params = {}, options = {}) {
  const fetcher = useCallback(
    () => import('@/services/api').then(({ default: api }) => api.getNotices(params)),
    [JSON.stringify(params)]
  );

  return useApiCache(
    'noticeboard',
    fetcher,
    {
      ttl: 180000, // 3 minutes for notices (more time-sensitive)
      ...options,
      dependencies: [params]
    }
  );
}

export function useNotice(slug, options = {}) {
  const fetcher = useCallback(
    () => import('@/services/api').then(({ default: api }) => api.getNoticeBySlug(slug)),
    [slug]
  );

  return useApiCache(
    `notice-${slug}`,
    slug ? fetcher : null,
    {
      ttl: 180000, // 3 minutes for notices
      ...options,
      enabled: !!slug && options.enabled !== false
    }
  );
}