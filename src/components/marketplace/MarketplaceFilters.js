import React from 'react';
import { X, CheckCircle2, AlertTriangle, HandCoins, Filter } from 'lucide-react';
import { normalizeText } from '@/lib/search';

const conditionOptions = [
  { value: '', label: 'Any Condition' },
  { value: 'brand new', label: 'Brand New' },
  { value: 'like new', label: 'Like New' },
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' }
];

function formatNumber(value) {
  if (!value) return '';
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function parseNumber(value) {
  if (!value) return '';
  return String(value).replace(/,/g, '');
}

export const LISTING_BADGE_STYLES = {
  verified: {
    label: 'Verified',
    className: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
    Icon: CheckCircle2
  },
  urgent: {
    label: 'Urgent',
    className: 'bg-red-100 text-red-800 border border-red-200',
    Icon: AlertTriangle
  },
  negotiable: {
    label: 'Negotiable',
    className: 'bg-yellow-100 text-yellow-900 border border-yellow-300',
    Icon: HandCoins
  }
};

export function ListingTagBadges({ flags = {} }) {
  const entries = Object.entries(LISTING_BADGE_STYLES).filter(([key]) => Boolean(flags[key]));
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {entries.map(([key, config]) => (
        <span
          key={key}
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${config.className}`}
        >
          <config.Icon className="h-3.5 w-3.5" />
          {config.label}
        </span>
      ))}
    </div>
  );
}

export default function MarketplaceFilters({
  filters,
  setFilters,
  searchQuery,
  setSearchQuery,
  onApply,
  onReset
}) {
  const handleFilterChange = (event) => {
    const { name, value } = event.target;

    if (name === 'minPrice' || name === 'maxPrice') {
      const parsed = parseNumber(value);
      if (parsed === '' || /^\d*$/.test(parsed)) {
        setFilters((prev) => ({ ...prev, [name]: parsed }));
      }
      return;
    }

    if (name === 'condition') {
      setFilters((prev) => ({ ...prev, [name]: normalizeText(value) }));
      return;
    }

    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Filter className="h-4 w-4 text-blue-600" />
        <h3 className="text-sm font-semibold text-gray-900">Marketplace Filters</h3>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search items..."
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <select
          name="condition"
          value={filters.condition || ''}
          onChange={handleFilterChange}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {conditionOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <input
          type="text"
          name="minPrice"
          value={formatNumber(filters.minPrice)}
          onChange={handleFilterChange}
          placeholder="Min Price"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <input
          type="text"
          name="maxPrice"
          value={formatNumber(filters.maxPrice)}
          onChange={handleFilterChange}
          placeholder="Max Price"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <X className="h-4 w-4" />
          Reset
        </button>

        <button
          type="button"
          onClick={onApply}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Apply
        </button>
      </div>
    </div>
  );
}

