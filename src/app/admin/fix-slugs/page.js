'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { generateDocumentSlug } from '@/utils/slugify';
import { RefreshCw, Check, X, AlertTriangle } from 'lucide-react';

export default function FixSlugsPage() {
  const { user } = useAuth();
  const [duplicates, setDuplicates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(new Set());
  const [updated, setUpdated] = useState(new Set());
  const [errors, setErrors] = useState({});

  // Load duplicate slugs
  useEffect(() => {
    loadDuplicates();
  }, []);

  const loadDuplicates = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/duplicate-slugs');
      const data = await response.json();
      
      if (data.success) {
        setDuplicates(data.duplicates || []);
      } else {
        console.error('Failed to load duplicates:', data.error);
      }
    } catch (error) {
      console.error('Error loading duplicates:', error);
    } finally {
      setLoading(false);
    }
  };

  const fixSlug = async (propertyId, title, oldSlug) => {
    setUpdating(prev => new Set([...prev, propertyId]));
    
    try {
      const newSlug = generateDocumentSlug(title, propertyId);
      
      const response = await fetch(`/api/admin/fix-slug`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          propertyId, 
          newSlug,
          oldSlug,
          userId: user?.uid || 'admin-user' // Include userId for auth middleware
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setUpdated(prev => new Set([...prev, propertyId]));
        // Remove from duplicates list
        setDuplicates(prev => prev.map(group => ({
          ...group,
          properties: group.properties.filter(p => p.id !== propertyId)
        })).filter(group => group.properties.length > 1));
      } else {
        setErrors(prev => ({ ...prev, [propertyId]: data.error }));
      }
    } catch (error) {
      setErrors(prev => ({ ...prev, [propertyId]: error.message }));
    } finally {
      setUpdating(prev => {
        const next = new Set(prev);
        next.delete(propertyId);
        return next;
      });
    }
  };

  const fixAllInGroup = async (group) => {
    for (const property of group.properties) {
      await fixSlug(property.id, property.title, group.slug);
      // Small delay between updates
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h2>
          <p className="text-gray-600">Please log in to access admin tools.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900">Fix Duplicate Slugs</h1>
              <button
                onClick={loadDuplicates}
                disabled={loading}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="text-center py-8">
                <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Loading duplicate slugs...</p>
              </div>
            ) : duplicates.length === 0 ? (
              <div className="text-center py-8">
                <Check className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Duplicates Found!</h3>
                <p className="text-gray-600">All property slugs are unique.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />
                    <p className="text-yellow-800">
                      Found <strong>{duplicates.length}</strong> duplicate slugs affecting{' '}
                      <strong>{duplicates.reduce((sum, group) => sum + group.properties.length, 0)}</strong> properties.
                    </p>
                  </div>
                </div>

                {duplicates.map((group, index) => (
                  <div key={group.slug} className="border border-gray-200 rounded-lg">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-gray-900">
                            Slug: "{group.slug}"
                          </h3>
                          <p className="text-sm text-gray-600">
                            {group.properties.length} properties using this slug
                          </p>
                        </div>
                        <button
                          onClick={() => fixAllInGroup(group)}
                          className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                        >
                          Fix All
                        </button>
                      </div>
                    </div>
                    
                    <div className="divide-y divide-gray-200">
                      {group.properties.map((property) => (
                        <div key={property.id} className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900">{property.title}</h4>
                              <p className="text-sm text-gray-600">ID: {property.id}</p>
                              <p className="text-sm text-gray-500">
                                New slug: {generateDocumentSlug(property.title, property.id)}
                              </p>
                              {errors[property.id] && (
                                <p className="text-sm text-red-600 mt-1">
                                  Error: {errors[property.id]}
                                </p>
                              )}
                            </div>
                            
                            <div className="ml-4">
                              {updated.has(property.id) ? (
                                <div className="flex items-center text-green-600">
                                  <Check className="w-4 h-4 mr-1" />
                                  <span className="text-sm">Fixed</span>
                                </div>
                              ) : (
                                <button
                                  onClick={() => fixSlug(property.id, property.title, group.slug)}
                                  disabled={updating.has(property.id)}
                                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                                >
                                  {updating.has(property.id) ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                  ) : (
                                    'Fix Slug'
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}