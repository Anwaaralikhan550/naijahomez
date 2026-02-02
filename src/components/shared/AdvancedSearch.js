'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Filter, 
  X, 
  Calendar, 
  MapPin, 
  Users, 
  Tag,
  SlidersHorizontal,
  ChevronDown,
  Check
} from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

// Advanced search hook
export const useAdvancedSearch = (data = [], searchConfig = {}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({});
  const [sortBy, setSortBy] = useState(searchConfig.defaultSort || 'relevance');
  const [sortOrder, setSortOrder] = useState('desc');
  
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  
  const searchResults = useCallback(() => {
    if (!data.length) return [];
    
    let filtered = [...data];
    
    // Text search
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      const searchFields = searchConfig.searchFields || ['name', 'title', 'description'];
      
      filtered = filtered.filter(item => 
        searchFields.some(field => {
          const value = getNestedValue(item, field);
          return value && value.toString().toLowerCase().includes(searchLower);
        })
      );
    }
    
    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '' || value === 'all') {
        return; // Skip empty filters
      }
      
      filtered = filtered.filter(item => {
        const itemValue = getNestedValue(item, key);
        
        if (Array.isArray(value)) {
          // Multi-select filter
          return value.some(v => itemValue === v || (Array.isArray(itemValue) && itemValue.includes(v)));
        } else if (typeof value === 'object' && value.min !== undefined && value.max !== undefined) {
          // Range filter
          const numValue = parseFloat(itemValue);
          return numValue >= value.min && numValue <= value.max;
        } else if (typeof value === 'boolean') {
          // Boolean filter
          return itemValue === value;
        } else {
          // Exact match filter
          return itemValue === value;
        }
      });
    });
    
    // Sort results
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      if (sortBy === 'relevance' && debouncedSearchTerm) {
        // Calculate relevance score
        aValue = calculateRelevance(a, debouncedSearchTerm, searchConfig.searchFields);
        bValue = calculateRelevance(b, debouncedSearchTerm, searchConfig.searchFields);
      } else {
        aValue = getNestedValue(a, sortBy);
        bValue = getNestedValue(b, sortBy);
      }
      
      // Handle different data types
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.toLowerCase().localeCompare(bValue.toLowerCase());
        return sortOrder === 'asc' ? comparison : -comparison;
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      } else if (aValue instanceof Date && bValue instanceof Date) {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      } else {
        // Fallback comparison
        return sortOrder === 'asc' 
          ? String(aValue).localeCompare(String(bValue))
          : String(bValue).localeCompare(String(aValue));
      }
    });
    
    return filtered;
  }, [data, debouncedSearchTerm, filters, sortBy, sortOrder, searchConfig]);
  
  const results = searchResults();
  
  return {
    searchTerm,
    setSearchTerm,
    filters,
    setFilters,
    updateFilter: (key, value) => setFilters(prev => ({ ...prev, [key]: value })),
    removeFilter: (key) => setFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[key];
      return newFilters;
    }),
    clearFilters: () => setFilters({}),
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    results,
    resultCount: results.length,
    hasActiveFilters: Object.keys(filters).some(key => 
      filters[key] !== null && filters[key] !== undefined && filters[key] !== '' && filters[key] !== 'all'
    )
  };
};

// Helper functions
const getNestedValue = (obj, path) => {
  return path.split('.').reduce((current, key) => current?.[key], obj);
};

const calculateRelevance = (item, searchTerm, searchFields = []) => {
  let score = 0;
  const searchLower = searchTerm.toLowerCase();
  
  searchFields.forEach((field, index) => {
    const value = getNestedValue(item, field);
    if (!value) return;
    
    const valueLower = value.toString().toLowerCase();
    
    // Exact match gets highest score
    if (valueLower === searchLower) {
      score += 100;
    }
    // Starts with gets high score
    else if (valueLower.startsWith(searchLower)) {
      score += 80;
    }
    // Contains gets medium score
    else if (valueLower.includes(searchLower)) {
      score += 50;
    }
    
    // Weight by field importance (first fields are more important)
    score *= (searchFields.length - index) / searchFields.length;
  });
  
  return score;
};

// Advanced Search Component
export const AdvancedSearch = ({
  searchConfig,
  onSearchChange,
  onFiltersChange,
  className = ''
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const [localFilters, setLocalFilters] = useState({});
  
  const {
    searchFields = [],
    filters: availableFilters = [],
    sortOptions = [],
    placeholder = 'Search...'
  } = searchConfig;

  const handleSearchChange = (term) => {
    onSearchChange?.(term);
  };

  const handleFilterChange = (key, value) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    onFiltersChange?.(newFilters);
  };

  const clearAllFilters = () => {
    setLocalFilters({});
    onFiltersChange?.({});
  };

  const activeFilterCount = Object.keys(localFilters).filter(key =>
    localFilters[key] !== null && localFilters[key] !== undefined && 
    localFilters[key] !== '' && localFilters[key] !== 'all'
  ).length;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder={placeholder}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        
        {/* Filter Toggle Button */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded ${
            showFilters ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-900">Filters</h3>
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear all ({activeFilterCount})
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableFilters.map((filter) => (
              <FilterField
                key={filter.key}
                filter={filter}
                value={localFilters[filter.key]}
                onChange={(value) => handleFilterChange(filter.key, value)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Active Filters */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(localFilters)
            .filter(([_, value]) => value !== null && value !== undefined && value !== '' && value !== 'all')
            .map(([key, value]) => {
              const filter = availableFilters.find(f => f.key === key);
              const displayValue = Array.isArray(value) ? value.join(', ') : value;
              
              return (
                <span
                  key={key}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                >
                  <span className="font-medium">{filter?.label}:</span>
                  <span className="ml-1">{displayValue}</span>
                  <button
                    onClick={() => handleFilterChange(key, null)}
                    className="ml-2 hover:text-blue-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
        </div>
      )}
    </div>
  );
};

// Individual Filter Field Component
const FilterField = ({ filter, value, onChange }) => {
  const { type, label, options, placeholder } = filter;

  switch (type) {
    case 'select':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
          <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      );

    case 'multiselect':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
          <MultiSelectDropdown
            options={options}
            value={value || []}
            onChange={onChange}
            placeholder={placeholder}
          />
        </div>
      );

    case 'range':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
          <div className="flex space-x-2">
            <input
              type="number"
              placeholder="Min"
              value={value?.min || ''}
              onChange={(e) => onChange({ ...value, min: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <input
              type="number"
              placeholder="Max"
              value={value?.max || ''}
              onChange={(e) => onChange({ ...value, max: parseFloat(e.target.value) || Infinity })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      );

    case 'date':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
          <input
            type="date"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      );

    case 'checkbox':
      return (
        <div className="flex items-center">
          <input
            type="checkbox"
            id={filter.key}
            checked={value || false}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor={filter.key} className="ml-2 text-sm text-gray-700">
            {label}
          </label>
        </div>
      );

    default:
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      );
  }
};

// Multi-select dropdown component
const MultiSelectDropdown = ({ options, value, onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const handleToggleOption = (optionValue) => {
    const newValue = value.includes(optionValue)
      ? value.filter(v => v !== optionValue)
      : [...value, optionValue];
    onChange(newValue);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-left flex items-center justify-between"
      >
        <span className="truncate">
          {value.length === 0 
            ? placeholder || 'Select options...'
            : `${value.length} selected`
          }
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {options.map((option) => (
            <label
              key={option.value}
              className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={value.includes(option.value)}
                onChange={() => handleToggleOption(option.value)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-3"
              />
              <span className="text-sm text-gray-700">{option.label}</span>
              {value.includes(option.value) && (
                <Check className="w-4 h-4 text-blue-600 ml-auto" />
              )}
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdvancedSearch;