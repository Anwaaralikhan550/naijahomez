'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { MapPin, DollarSign, Calendar, TrendingUp } from 'lucide-react';

export default function MapsUsagePage() {
  const { user } = useAuth();
  const [usageStats, setUsageStats] = useState({
    today: 0,
    thisMonth: 0,
    cached: 0,
    estimatedCost: 0
  });

  useEffect(() => {
    calculateUsage();
  }, []);

  const calculateUsage = () => {
    if (typeof window === 'undefined') return;

    const today = new Date().toDateString();
    const todayCount = parseInt(localStorage.getItem(`geocode_count_${today}`) || '0');
    
    // Calculate monthly usage
    let monthlyCount = 0;
    let cachedAddresses = 0;
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('geocode_count_')) {
        const date = key.replace('geocode_count_', '');
        const count = parseInt(localStorage.getItem(key) || '0');
        
        // If it's this month, add to monthly count
        if (new Date(date).getMonth() === new Date().getMonth()) {
          monthlyCount += count;
        }
      } else if (key?.startsWith('geocode_')) {
        cachedAddresses++;
      }
    }
    
    // Estimate costs (rough calculation)
    const geocodingCost = (monthlyCount * 0.005); // $5 per 1000 requests
    const mapLoadsCost = (monthlyCount * 0.007); // Assuming map loads with geocoding
    const totalCost = geocodingCost + mapLoadsCost;

    setUsageStats({
      today: todayCount,
      thisMonth: monthlyCount,
      cached: cachedAddresses,
      estimatedCost: totalCost
    });
  };

  const clearCache = () => {
    if (typeof window === 'undefined') return;
    
    const keysToDelete = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('geocode_')) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => localStorage.removeItem(key));
    calculateUsage();
  };

  const resetCounters = () => {
    if (typeof window === 'undefined') return;
    
    const keysToDelete = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('geocode_count_')) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => localStorage.removeItem(key));
    calculateUsage();
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h2>
          <p className="text-gray-600">Please log in to view usage statistics.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">Google Maps API Usage</h1>
            <p className="text-gray-600 mt-1">Monitor your API usage and costs</p>
          </div>

          <div className="p-6">
            {/* Usage Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center">
                  <Calendar className="w-8 h-8 text-blue-600 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-blue-800">Today</p>
                    <p className="text-2xl font-bold text-blue-900">{usageStats.today}</p>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center">
                  <TrendingUp className="w-8 h-8 text-green-600 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-green-800">This Month</p>
                    <p className="text-2xl font-bold text-green-900">{usageStats.thisMonth}</p>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center">
                  <MapPin className="w-8 h-8 text-purple-600 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-purple-800">Cached</p>
                    <p className="text-2xl font-bold text-purple-900">{usageStats.cached}</p>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center">
                  <DollarSign className="w-8 h-8 text-yellow-600 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800">Est. Cost</p>
                    <p className="text-2xl font-bold text-yellow-900">${usageStats.estimatedCost.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Cost Breakdown */}
            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost Optimization Features</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">✅ Active Optimizations:</h4>
                  <ul className="space-y-1 text-gray-600">
                    <li>• Persistent caching (saves ~90% on repeat addresses)</li>
                    <li>• Daily rate limiting (100 requests/day)</li>
                    <li>• Fallback to Lagos center for failed geocodes</li>
                    <li>• Lazy loading maps (only when needed)</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">💡 Estimated Savings:</h4>
                  <ul className="space-y-1 text-gray-600">
                    <li>• {usageStats.cached} addresses cached forever</li>
                    <li>• ~${((usageStats.cached * 0.005)).toFixed(2)} saved from caching</li>
                    <li>• Rate limiting prevents runaway costs</li>
                    <li>• Smart fallbacks reduce failed API calls</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-4">
              <button
                onClick={calculateUsage}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Refresh Stats
              </button>
              <button
                onClick={clearCache}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
              >
                Clear Cache
              </button>
              <button
                onClick={resetCounters}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Reset Counters
              </button>
            </div>

            {/* Recommendations */}
            <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">💰 Cost Reduction Tips:</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Current setup should cost ~$5-15/month for moderate usage</li>
                <li>• Add coordinates directly to property database to avoid geocoding</li>
                <li>• Consider batch geocoding for new properties server-side</li>
                <li>• Monitor usage regularly and adjust daily limits if needed</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}