const DEFAULT_SEARCH_FIELDS = ['title', 'name', 'description', 'location'];

function toPlainString(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

export function normalizeText(value) {
  return toPlainString(value).trim().toLowerCase();
}

export function tokenizeSearchQuery(query) {
  return normalizeText(query)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

export function matchTextSearch(item, query, fields = DEFAULT_SEARCH_FIELDS) {
  const tokens = tokenizeSearchQuery(query);
  if (tokens.length === 0) return true;

  const haystack = fields
    .map((field) => normalizeText(item?.[field]))
    .filter(Boolean)
    .join(' ');

  return tokens.every((token) => haystack.includes(token));
}

export function filterBySearch(items = [], query, fields = DEFAULT_SEARCH_FIELDS) {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => matchTextSearch(item, query, fields));
}

export function parseNumericPrice(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const cleaned = toPlainString(value).replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const parsed = Number.parseFloat(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
}

export function applyListingFilters(items = [], filters = {}, options = {}) {
  if (!Array.isArray(items)) return [];

  const {
    priceField = 'price',
    priceNumericField = 'priceNumeric',
    propertyTypeField = 'propertyType',
    locationField = 'location'
  } = options;

  const minPrice = parseNumericPrice(filters.minPrice);
  const maxPrice = parseNumericPrice(filters.maxPrice);
  const targetType = normalizeText(filters.propertyType);
  const targetLocation = normalizeText(filters.location);

  return items.filter((item) => {
    const numericPrice =
      parseNumericPrice(item?.[priceNumericField]) ??
      parseNumericPrice(item?.[priceField]) ??
      0;

    if (minPrice !== null && numericPrice < minPrice) return false;
    if (maxPrice !== null && numericPrice > maxPrice) return false;

    const normalizedType = normalizeText(item?.[propertyTypeField]);
    if (targetType && normalizedType !== targetType) return false;

    const normalizedLocation = normalizeText(item?.[locationField]);
    if (targetLocation && !normalizedLocation.includes(targetLocation)) return false;

    return true;
  });
}

export function sortAlertsByPriority(alerts = []) {
  const priorityRank = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1
  };

  if (!Array.isArray(alerts)) return [];

  return [...alerts].sort((a, b) => {
    const aPriority = priorityRank[normalizeText(a?.alertLevel)] || 0;
    const bPriority = priorityRank[normalizeText(b?.alertLevel)] || 0;
    if (aPriority !== bPriority) return bPriority - aPriority;

    const aTime = new Date(a?.createdAt || 0).getTime();
    const bTime = new Date(b?.createdAt || 0).getTime();
    return bTime - aTime;
  });
}

export function createListingTagFlags(listing = {}) {
  const normalizedTitle = normalizeText(listing?.title);
  const normalizedTags = Array.isArray(listing?.tags)
    ? listing.tags.map((tag) => normalizeText(tag))
    : [];

  const isVerified = Boolean(listing?.isVerified || normalizedTags.includes('verified'));
  const isUrgent = Boolean(
    listing?.isUrgent ||
    normalizedTags.includes('urgent') ||
    normalizedTitle.includes('urgent')
  );
  const isNegotiable = Boolean(
    listing?.isNegotiable ||
    normalizedTags.includes('negotiable') ||
    normalizeText(listing?.price).includes('negotiable')
  );

  return {
    verified: isVerified,
    urgent: isUrgent,
    negotiable: isNegotiable
  };
}

