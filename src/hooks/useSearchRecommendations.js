'use client';
import { useState, useRef } from 'react';
import apiService from '@/services/api';

export const useSearchRecommendations = (listingType = 'mixed') => {
  const [isOpen, setIsOpen] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef(null);

  // Fetch recommended listings based on type
  const fetchRecommendations = async () => {
    setIsLoading(true);
    try {
      const formatRecord = (item, type, hrefBase) => {
        if (!item?.imageUrls?.length) return null;
        const rawSlug = item.slug;
        const rawId = item.id;
        const safeSlug = (typeof rawSlug === 'string' || typeof rawSlug === 'number') ? String(rawSlug).trim() : '';
        const safeId = (typeof rawId === 'string' || typeof rawId === 'number') ? String(rawId).trim() : '';
        const segment = safeSlug || safeId;
        if (!segment) return null;

        return {
          id: safeId || segment,
          type,
          title: item.title || 'Untitled',
          location: item.location || 'Unknown location',
          price: item.rate || item.priceString || item.price || 'Contact for price',
          image: item.imageUrls[0],
          slug: safeSlug,
          href: `/${hrefBase}/${encodeURIComponent(segment)}`
        };
      };

      const loadProperties = async (limit = 8) => {
        const response = await apiService.getProperties({ limit, sortBy: 'createdAt', sortOrder: 'desc' });
        if (!response?.success) return [];
        return (response.data || [])
          .map((item) => formatRecord(item, 'property', 'property'))
          .filter(Boolean);
      };

      const loadMarketplace = async (limit = 8) => {
        const response = await apiService.getMarketplaceItems({ limit, sortBy: 'createdAt', sortOrder: 'desc' });
        if (!response?.success) return [];
        return (response.data || [])
          .map((item) => formatRecord(item, 'marketplace', 'marketplace'))
          .filter(Boolean);
      };

      const loadServices = async (limit = 8) => {
        const response = await apiService.getTradespeople({ limit, sortBy: 'createdAt', sortOrder: 'desc' });
        if (!response?.success) return [];
        return (response.data || [])
          .map((item) => formatRecord(item, 'service', 'tradespeople'))
          .filter(Boolean);
      };

      const loadHousemates = async (limit = 8) => {
        const response = await apiService.getHousemates({ limit, sortBy: 'createdAt', sortOrder: 'desc' });
        if (!response?.success) return [];
        return (response.data || [])
          .map((item) => formatRecord(item, 'housemate', 'housemate'))
          .filter(Boolean);
      };

      const loadNoticeboard = async (limit = 8) => {
        const response = await apiService.getNotices({ limit, sortBy: 'createdAt', sortOrder: 'desc' });
        if (!response?.success) return [];
        return (response.data || [])
          .map((item) => {
            const mapped = formatRecord(item, 'noticeboard', 'noticeboard');
            return mapped ? { ...mapped, price: 'Free' } : null;
          })
          .filter(Boolean);
      };

      let results = [];

      switch (listingType) {
        case 'property':
          results = await loadProperties();
          break;
        case 'marketplace':
          results = await loadMarketplace();
          break;
        case 'service':
          results = await loadServices();
          break;
        case 'housemate':
          // Uses /api/housemates (plural collection backing).
          results = await loadHousemates();
          break;
        case 'noticeboard':
          results = await loadNoticeboard();
          break;
        default: {
          const [properties, marketplace, services] = await Promise.all([
            loadProperties(2),
            loadMarketplace(2),
            loadServices(1)
          ]);
          results = [...properties, ...marketplace, ...services];
          break;
        }
      }

      // Shuffle and limit to 5
      const shuffled = results.sort(() => 0.5 - Math.random());
      setRecommendations(shuffled.slice(0, 5));
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      setRecommendations([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle search focus
  const handleFocus = () => {
    setIsOpen(true);
    if (recommendations.length === 0) {
      fetchRecommendations();
    }
  };

  // Handle close dropdown
  const handleClose = () => {
    setIsOpen(false);
  };

  return {
    isOpen,
    recommendations,
    isLoading,
    handleFocus,
    handleClose,
    dropdownRef
  };
};
