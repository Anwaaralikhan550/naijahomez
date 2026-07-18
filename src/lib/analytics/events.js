const ANALYTICS_DEBUG =
  process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === 'true' ||
  process.env.NODE_ENV !== 'production';

function isValidPayload(id, type) {
  if (id === undefined || id === null) return false;
  if (!type || typeof type !== 'string') return false;
  return true;
}

async function postEvent(url, payload) {
  try {
    if (typeof window === 'undefined') {
      return false;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
      credentials: 'same-origin'
    });

    if (!response.ok && ANALYTICS_DEBUG) {
      console.debug(`[analytics] ${url} failed`, response.status);
    }

    return response.ok;
  } catch (error) {
    if (ANALYTICS_DEBUG) {
      console.debug(`[analytics] ${url} error`, error);
    }
    return false;
  }
}

export async function trackImpression(id, type) {
  if (!isValidPayload(id, type)) {
    if (ANALYTICS_DEBUG) {
      console.debug('[analytics] invalid impression payload', { id, type });
    }
    return false;
  }

  return postEvent('/api/analytics/listing-impression', {
    listingId: String(id),
    listingType: String(type).toLowerCase()
  });
}

export async function trackClick(id, type) {
  if (!isValidPayload(id, type)) {
    if (ANALYTICS_DEBUG) {
      console.debug('[analytics] invalid click payload', { id, type });
    }
    return false;
  }

  return postEvent('/api/analytics/listing-click', {
    listingId: String(id),
    listingType: String(type).toLowerCase()
  });
}

export async function trackJourneyStep(step, details = {}) {
  if (!step || typeof step !== 'string') return false;
  const page = details.page || (typeof window !== 'undefined' ? window.location.pathname : '');
  const dedupeKey = details.dedupeKey || `${step}:${details.source || ''}:${details.listingType || ''}:${page}`;
  if (typeof window !== 'undefined' && details.dedupe !== false) {
    const storageKey = `nijahomzs_journey:${dedupeKey}`;
    if (window.sessionStorage.getItem(storageKey)) return true;
    window.sessionStorage.setItem(storageKey, '1');
  }
  return postEvent('/api/analytics/journey', {
    step,
    source: details.source || '',
    location: details.location || '',
    listingType: details.listingType || '',
    page,
    device: details.device || '',
    element: details.element || ''
  });
}

export async function trackAdImpressions(impressions = []) {
  if (!Array.isArray(impressions) || impressions.length === 0) return false;
  return postEvent('/api/advertising/impression', { impressions });
}

export async function trackHeatmapClick(details = {}) {
  if (typeof window === 'undefined') return false;
  const viewportWidth = Math.max(1, window.innerWidth || 1);
  const viewportHeight = Math.max(1, window.innerHeight || 1);
  const x = Math.max(0, Math.min(100, Number(details.xPercent || 0)));
  const y = Math.max(0, Math.min(100, Number(details.yPercent || 0)));

  return postEvent('/api/analytics/heatmap', {
    page: details.page || window.location.pathname,
    element: details.element || '',
    xPercent: Math.round(x),
    yPercent: Math.round(y),
    viewport: `${viewportWidth}x${viewportHeight}`,
    device: viewportWidth < 768 ? 'mobile' : viewportWidth < 1024 ? 'tablet' : 'desktop'
  });
}
