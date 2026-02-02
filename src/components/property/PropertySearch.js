// components/property/PropertySearch.js
import { useState } from 'react';
import { Search } from 'lucide-react';

export default function PropertySearch({ onSearch, searchQuery, setSearchQuery, isLoading }) {
  const handleSearch = (e) => {
    e.preventDefault();
    onSearch(true);
  };

  return (
    <form onSubmit={handleSearch} className="flex items-center space-x-4">
      <div className="flex-grow relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="text-gray-400" size={20} />
        </div>
        <input
          type="text"
          placeholder="Search properties by title, location, or description..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <button 
        type="submit"
        disabled={isLoading}
        className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors disabled:bg-blue-300"
      >
        {isLoading ? 'Searching...' : 'Search'}
      </button>
    </form>
  );
}