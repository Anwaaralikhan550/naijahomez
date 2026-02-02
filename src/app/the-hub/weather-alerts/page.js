'use client';
import { useState, useEffect } from 'react';
import HubLayout from '@/components/hub/HubLayout';
import WeatherAlerts from '@/components/hub/emergency/WeatherAlerts';
import { useAuth } from '@/context/AuthContext';

export default function WeatherAlertsPage() {
  const { user } = useAuth();
  const [currentCommunity, setCurrentCommunity] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem('hubCurrentCommunity');
    if (stored) {
      setCurrentCommunity(stored);
    }
  }, []);

  return (
    <HubLayout>
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 rounded-full bg-orange-100 text-orange-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Weather & Emergency Alerts</h1>
        </div>
        
        {currentCommunity ? (
          <WeatherAlerts communityId={currentCommunity} />
        ) : (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-600 mb-4">
              Please select a community to access weather alerts.
            </p>
          </div>
        )}
      </div>
    </HubLayout>
  );
}