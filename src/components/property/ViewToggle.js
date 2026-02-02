'use client';
import { Map, List } from 'lucide-react';

export default function ViewToggle({ view, onViewChange }) {
  return (
    <div className="flex items-center bg-gray-100 rounded-lg p-1">
      <button
        onClick={() => onViewChange('list')}
        className={`flex items-center space-x-2 px-3 py-1.5 rounded-md transition-all ${
          view === 'list'
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
        aria-label="List view"
      >
        <List size={18} />
        <span className="text-sm font-medium">List</span>
      </button>
      <button
        onClick={() => onViewChange('map')}
        className={`flex items-center space-x-2 px-3 py-1.5 rounded-md transition-all ${
          view === 'map'
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
        aria-label="Map view"
      >
        <Map size={18} />
        <span className="text-sm font-medium">Map</span>
      </button>
    </div>
  );
}