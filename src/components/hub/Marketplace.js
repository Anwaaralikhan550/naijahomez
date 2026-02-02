'use client';
import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  Plus, 
  Search, 
  ExternalLink,
  MapPin,
  Clock,
  User,
  Tag,
  Eye,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authenticatedFetch } from '@/services/api';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

const Marketplace = ({ communityId: propCommunityId }) => {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [currentCommunity, setCurrentCommunity] = useState(propCommunityId || null);
  const [communityLocation, setCommunityLocation] = useState('');
  const [totalCount, setTotalCount] = useState(0);

  const categories = [
    'Electronics',
    'Furniture',
    'Appliances',
    'Books',
    'Clothing',
    'Sports & Recreation',
    'Home & Garden',
    'Vehicles',
    'Services',
    'Other'
  ];

  const conditions = [
    'New',
    'Like New',
    'Good',
    'Fair',
    'Poor'
  ];

  // Get current community and location
  useEffect(() => {
    const loadCommunity = async () => {
      if (propCommunityId) {
        setCurrentCommunity(propCommunityId);
        return;
      }

      if (user) {
        try {
          // Check localStorage first
          const stored = localStorage.getItem('hubCurrentCommunity');
          if (stored) {
            setCurrentCommunity(stored);
            return;
          }

          // Get user's communities to find primary community
          const response = await authenticatedFetch(`/api/hub/communities?type=user&userId=${user.uid}`);
          const result = await response.json();

          if (response.ok && result.communities?.length > 0) {
            const primaryCommunity = result.communities.find(c => c.role === 'admin') || result.communities[0];
            setCurrentCommunity(primaryCommunity.id);
            setCommunityLocation(primaryCommunity.location || primaryCommunity.address || '');
          }
        } catch (error) {
          console.error('Error loading community:', error);
        }
      }
    };

    loadCommunity();
  }, [user, propCommunityId]);

  useEffect(() => {
    if (currentCommunity) {
      loadMarketplaceItems();
    }
  }, [currentCommunity]);

  const loadMarketplaceItems = async () => {
    try {
      setLoading(true);
      
      // Fetch from main marketplace API with location filter
      let url = '/api/marketplace?limit=50';
      if (communityLocation) {
        url += `&location=${encodeURIComponent(communityLocation)}`;
      }
      if (searchTerm) {
        url += `&search=${encodeURIComponent(searchTerm)}`;
      }
      if (categoryFilter !== 'all') {
        url += `&category=${encodeURIComponent(categoryFilter)}`;
      }
      
      const response = await authenticatedFetch(url);
      const result = await response.json();

      if (response.ok) {
        setItems(result.data || []);
        setTotalCount(result.pagination?.total || 0);
      }
    } catch (error) {
      console.error('Error loading marketplace items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewItem = () => {
    // Navigate to main marketplace to create new item
    router.push('/marketplace?create=true');
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString();
  };

  const formatPrice = (price) => {
    if (!price) return 'Free';
    return `₦${price.toLocaleString()}`;
  };

  // Items are already filtered server-side, so just use them directly
  const filteredItems = items;

  // Trigger search when search term or filter changes
  useEffect(() => {
    if (currentCommunity) {
      const delayedSearch = setTimeout(() => {
        loadMarketplaceItems();
      }, 300); // Debounce search
      
      return () => clearTimeout(delayedSearch);
    }
  }, [searchTerm, categoryFilter, currentCommunity]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Community Marketplace</h2>
          <p className="text-gray-600">
            Local marketplace items {communityLocation && `near ${communityLocation}`}
            {totalCount > 0 && ` (${totalCount} items)`}
          </p>
        </div>
        <button
          onClick={handleCreateNewItem}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Post Item
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div className="flex items-center space-x-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="all">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => router.push('/marketplace')}
          className="flex items-center px-3 py-2 text-green-600 border border-green-600 rounded-lg hover:bg-green-50 transition"
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          View Full Marketplace
        </button>
      </div>


      {/* Items Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full mx-auto"></div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <ShoppingBag className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-lg">No items found</p>
          <p className="text-sm">
            {searchTerm || categoryFilter !== 'all' 
              ? 'Try adjusting your search or filters' 
              : communityLocation ? `No marketplace items found near ${communityLocation}` : 'No marketplace items found'}
          </p>
          <button
            onClick={() => router.push('/marketplace?create=true')}
            className="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
          >
            Post the first item!
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => (
            <div key={item.id} className="bg-white rounded-lg shadow hover:shadow-lg transition">
              {/* Item Image */}
              <div className="h-48 bg-gray-200 rounded-t-lg overflow-hidden">
                {item.imageUrls && item.imageUrls.length > 0 ? (
                  <img
                    src={item.imageUrls[0] || '/api/placeholder/400/300'}
                    alt={item.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      e.target.src = '/api/placeholder/400/300';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ShoppingBag className="w-12 h-12 text-gray-400" />
                  </div>
                )}
              </div>
              
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-gray-900 text-lg">{item.title}</h3>
                  <span className="text-lg font-bold text-green-600">
                    {formatPrice(item.price)}
                  </span>
                </div>
                
                <div className="flex items-center space-x-2 mb-2">
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                    {item.category}
                  </span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                    {item.condition}
                  </span>
                </div>
                
                <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                  {item.description}
                </p>
                
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center">
                    <User className="w-3 h-3 mr-1" />
                    {item.sellerName || 'Seller'}
                  </div>
                  <div className="flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {formatDate(item.createdAt)}
                  </div>
                </div>
                
                {item.location && (
                  <div className="flex items-center text-xs text-gray-500 mt-1">
                    <MapPin className="w-3 h-3 mr-1" />
                    {item.location}
                  </div>
                )}
                
                <div className="mt-3 pt-3 border-t">
                  <button 
                    onClick={() => router.push(`/marketplace/${item.slug || item.id}`)}
                    className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition text-sm flex items-center justify-center"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Marketplace;