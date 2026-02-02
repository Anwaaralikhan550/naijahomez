'use client';
// components/home/HeroSearch.js
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

export default function HeroSearch() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <form onSubmit={handleSearch} className="flex items-center bg-white rounded-lg overflow-hidden shadow-lg">
        <input
          type="text"
          placeholder="Search for anything..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-6 py-4 outline-none bg-gray-50 text-gray-900 placeholder-gray-500"
        />
        <button 
          type="submit" 
          className="px-6 py-4 bg-orange-500 hover:bg-orange-600 text-white transition-colors"
        >
          <Search size={24} />
        </button>
      </form>
    </div>
  );
}