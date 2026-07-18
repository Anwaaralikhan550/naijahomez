'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, Megaphone } from 'lucide-react';
import { trackAdImpressions } from '@/lib/analytics/events';

function sessionKey(ad, slot) {
  return `nijahomzs_ad_seen:${ad?.id}:${slot}:${typeof window !== 'undefined' ? window.location.pathname : ''}`;
}

export default function SponsoredAdSlot({
  slot,
  location = '',
  propertyCategory = '',
  variant = 'card',
  className = ''
}) {
  const [ad, setAd] = useState(null);
  const [loading, setLoading] = useState(true);
  const ref = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ slot, location, propertyCategory, limit: '1' });
    fetch(`/api/advertising/select?${params.toString()}`)
      .then((response) => response.json())
      .then((result) => {
        if (!cancelled) setAd(Array.isArray(result.ads) ? result.ads[0] || null : null);
      })
      .catch(() => {
        if (!cancelled) setAd(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slot, location, propertyCategory]);

  useEffect(() => {
    if (!ad || !ref.current || typeof window === 'undefined') return undefined;
    const key = sessionKey(ad, slot);
    if (window.sessionStorage.getItem(key)) return undefined;

    const observer = new IntersectionObserver((entries) => {
      const visible = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5);
      if (!visible) return;
      window.sessionStorage.setItem(key, '1');
      trackAdImpressions([{ campaignId: ad.id, slot, location, propertyCategory, count: 1 }]);
      observer.disconnect();
    }, { threshold: [0.5] });

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ad, slot, location, propertyCategory]);

  if (loading || !ad) return null;

  const clickUrl = `/api/advertising/click?${new URLSearchParams({
    campaignId: ad.id,
    slot,
    location,
    propertyCategory,
    to: ad.destinationUrl
  }).toString()}`;

  if (variant === 'banner') {
    return (
      <a
        ref={ref}
        href={clickUrl}
        className={`block overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm transition hover:shadow-lg ${className}`}
      >
        <div className="flex items-center gap-4 p-4">
          <img src={ad.creativeUrl} alt={ad.title} className="h-20 w-28 rounded-xl object-cover" />
          <div className="min-w-0 flex-1">
            <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
              <Megaphone className="h-3.5 w-3.5" />
              Sponsored
            </p>
            <h3 className="mt-1 line-clamp-1 font-bold text-blue-950">{ad.title}</h3>
            <p className="mt-1 line-clamp-2 text-sm text-gray-600">{ad.description}</p>
          </div>
          <ExternalLink className="h-5 w-5 text-blue-600" />
        </div>
      </a>
    );
  }

  return (
    <a
      ref={ref}
      href={clickUrl}
      className={`block overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${className}`}
    >
      <img src={ad.creativeUrl} alt={ad.title} className="h-40 w-full object-cover" />
      <div className="p-5">
        <p className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-100">
          <Megaphone className="h-3.5 w-3.5" />
          Sponsored
        </p>
        <h3 className="mt-3 line-clamp-2 text-lg font-bold text-blue-950">{ad.title}</h3>
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-gray-600">{ad.description}</p>
        <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-700">
          {ad.ctaLabel || 'Learn more'} <ExternalLink className="h-4 w-4" />
        </span>
      </div>
    </a>
  );
}
