'use client';
import { useState, useEffect, useRef } from 'react';
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
      let results = [];

      switch (listingType) {
        case 'property':
          const propertiesSnapshot = await getDocs(
            query(collection(db, 'properties'), orderBy('createdAt', 'desc'), limit(8))
          );
          propertiesSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.imageUrls && data.imageUrls.length > 0) {
              results.push({
                id: doc.id,
                type: 'property',
                title: data.title,
                location: data.location,
                price: data.rate || data.price,
                image: data.imageUrls[0],
                slug: data.slug,
                href: `/property/${data.slug || doc.id}`
              });
            }
          });
          break;

        case 'marketplace':
          const marketplaceSnapshot = await getDocs(
            query(collection(db, 'marketplace'), orderBy('createdAt', 'desc'), limit(8))
          );
          marketplaceSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.imageUrls && data.imageUrls.length > 0) {
              results.push({
                id: doc.id,
                type: 'marketplace',
                title: data.title,
                location: data.location,
                price: data.priceString || data.price,
                image: data.imageUrls[0],
                slug: data.slug,
                href: `/marketplace/${data.slug || doc.id}`
              });
            }
          });
          break;

        case 'service':
          const servicesSnapshot = await getDocs(
            query(collection(db, 'services'), orderBy('createdAt', 'desc'), limit(8))
          );
          servicesSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.imageUrls && data.imageUrls.length > 0) {
              results.push({
                id: doc.id,
                type: 'service',
                title: data.title,
                location: data.location,
                price: data.priceString || data.price,
                image: data.imageUrls[0],
                slug: data.slug,
                href: `/tradespeople/${data.slug || doc.id}`
              });
            }
          });
          break;

        case 'housemate':
          const housemateSnapshot = await getDocs(
            query(collection(db, 'housemate'), orderBy('createdAt', 'desc'), limit(8))
          );
          housemateSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.imageUrls && data.imageUrls.length > 0) {
              results.push({
                id: doc.id,
                type: 'housemate',
                title: data.title,
                location: data.location,
                price: data.rate || data.price,
                image: data.imageUrls[0],
                slug: data.slug,
                href: `/housemate/${data.slug || doc.id}`
              });
            }
          });
          break;

        case 'noticeboard':
          const noticeSnapshot = await getDocs(
            query(collection(db, 'noticeboard'), orderBy('createdAt', 'desc'), limit(8))
          );
          noticeSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.imageUrls && data.imageUrls.length > 0) {
              results.push({
                id: doc.id,
                type: 'noticeboard',
                title: data.title,
                location: data.location,
                price: 'Free', // Most notices are free
                image: data.imageUrls[0],
                slug: data.slug,
                href: `/noticeboard/${data.slug || doc.id}`
              });
            }
          });
          break;

        default:
          // Mixed - fallback for general search
          const [propertiesSnap, marketplaceSnap, servicesSnap] = await Promise.all([
            getDocs(query(collection(db, 'properties'), orderBy('createdAt', 'desc'), limit(2))),
            getDocs(query(collection(db, 'marketplace'), orderBy('createdAt', 'desc'), limit(2))),
            getDocs(query(collection(db, 'services'), orderBy('createdAt', 'desc'), limit(1)))
          ]);

          // Add properties
          propertiesSnap.docs.forEach(doc => {
            const data = doc.data();
            if (data.imageUrls && data.imageUrls.length > 0) {
              results.push({
                id: doc.id,
                type: 'property',
                title: data.title,
                location: data.location,
                price: data.rate || data.price,
                image: data.imageUrls[0],
                slug: data.slug,
                href: `/property/${data.slug || doc.id}`
              });
            }
          });

          // Add marketplace items
          marketplaceSnap.docs.forEach(doc => {
            const data = doc.data();
            if (data.imageUrls && data.imageUrls.length > 0) {
              results.push({
                id: doc.id,
                type: 'marketplace',
                title: data.title,
                location: data.location,
                price: data.priceString || data.price,
                image: data.imageUrls[0],
                slug: data.slug,
                href: `/marketplace/${data.slug || doc.id}`
              });
            }
          });

          // Add services
          servicesSnap.docs.forEach(doc => {
            const data = doc.data();
            if (data.imageUrls && data.imageUrls.length > 0) {
              results.push({
                id: doc.id,
                type: 'service',
                title: data.title,
                location: data.location,
                price: data.priceString || data.price,
                image: data.imageUrls[0],
                slug: data.slug,
                href: `/tradespeople/${data.slug || doc.id}`
              });
            }
          });
          break;
      }

      // Shuffle and limit to 5
      const shuffled = results.sort(() => 0.5 - Math.random());
      setRecommendations(shuffled.slice(0, 5));
    } catch (error) {
      console.error('Error fetching recommendations:', error);
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