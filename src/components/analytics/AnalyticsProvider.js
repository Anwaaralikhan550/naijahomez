'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Script from 'next/script';
import { trackHeatmapClick, trackJourneyStep } from '@/lib/analytics/events';

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

function listingTypeFromPath(pathname) {
  if (/^\/property\/[^/]+/.test(pathname)) return 'property';
  if (/^\/marketplace\/[^/]+/.test(pathname)) return 'marketplace';
  if (/^\/housemate\/[^/]+/.test(pathname)) return 'housemate';
  if (/^\/tradespeople\/[^/]+/.test(pathname)) return 'tradespeople';
  if (/^\/noticeboard\/[^/]+/.test(pathname)) return 'noticeboard';
  return '';
}

function elementLabel(target) {
  if (!target || typeof target.closest !== 'function') return 'page';
  const interactive = target.closest('a,button,[role="button"],input,select,textarea');
  if (!interactive) return 'page';
  const text = (interactive.getAttribute('aria-label') || interactive.textContent || interactive.name || interactive.id || '').trim();
  return text.replace(/\s+/g, ' ').slice(0, 80) || interactive.tagName.toLowerCase();
}

export default function AnalyticsProvider({ children }) {
  const pathname = usePathname() || '/';
  const isGaEnabled =
    typeof GA_MEASUREMENT_ID === 'string' && GA_MEASUREMENT_ID.trim().length > 0;

  useEffect(() => {
    const device = window.innerWidth < 768 ? 'mobile' : window.innerWidth < 1024 ? 'tablet' : 'desktop';
    trackJourneyStep('landing', {
      source: document.referrer ? 'referral' : 'direct',
      page: pathname,
      device,
      dedupeKey: `landing:${pathname}`
    });

    const listingType = listingTypeFromPath(pathname);
    if (listingType) {
      trackJourneyStep('listing_view', {
        source: 'route_view',
        listingType,
        page: pathname,
        device,
        dedupeKey: `route_listing_view:${pathname}`
      });
    }
  }, [pathname]);

  useEffect(() => {
    const handler = (event) => {
      const width = Math.max(1, window.innerWidth || 1);
      const height = Math.max(1, window.innerHeight || 1);
      trackHeatmapClick({
        page: pathname,
        element: elementLabel(event.target),
        xPercent: (event.clientX / width) * 100,
        yPercent: (event.clientY / height) * 100
      });
    };

    window.addEventListener('click', handler, { passive: true });
    return () => window.removeEventListener('click', handler);
  }, [pathname]);

  if (!isGaEnabled) {
    return <>{children}</>;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = window.gtag || gtag;
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', { anonymize_ip: true });
        `}
      </Script>
      {children}
    </>
  );
}
