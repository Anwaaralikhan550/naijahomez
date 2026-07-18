'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Cloud, 
  Droplets, 
  Zap, 
  AlertTriangle, 
  Sun, 
  CloudRain,
  CloudDrizzle,
  CloudSnow,
  Wind,
  Thermometer,
  Eye,
  Plus,
  Bell,
  MapPin
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authenticatedFetch } from '@/services/api';
import toast from 'react-hot-toast';

const WeatherAlerts = ({ communityId }) => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateAlert, setShowCreateAlert] = useState(false);

  // Mock weather data for Lagos area
  const [currentWeather, setCurrentWeather] = useState({
    temperature: 28,
    condition: 'partly-cloudy',
    humidity: 78,
    windSpeed: 12,
    visibility: 10,
    description: 'Partly Cloudy',
    rainChance: 45,
    location: 'Lagos, Nigeria'
  });

  // Form data for creating custom alerts
  const [alertForm, setAlertForm] = useState({
    title: '',
    message: '',
    type: 'weather', // weather, flood, power, general
    priority: 'medium', // low, medium, high, critical
    expiresAt: ''
  });

  const loadWeatherAlerts = useCallback(async () => {
    try {
      const response = await authenticatedFetch(`/api/hub/emergency-alerts?communityId=${communityId}&type=weather`);
      const result = await response.json();

      if (result.success) {
        setAlerts(result.data || []);
      }
    } catch (error) {
      console.error('Error loading weather alerts:', error);
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  const loadWeatherData = useCallback(() => {
    // In a real implementation, this would fetch from a weather API
    // For now, we'll simulate Lagos weather conditions
    const conditions = [
      { condition: 'sunny', temp: 32, rain: 10, desc: 'Sunny' },
      { condition: 'partly-cloudy', temp: 28, rain: 45, desc: 'Partly Cloudy' },
      { condition: 'cloudy', temp: 26, rain: 75, desc: 'Cloudy' },
      { condition: 'rainy', temp: 24, rain: 95, desc: 'Rainy' }
    ];
    
    const randomWeather = conditions[Math.floor(Math.random() * conditions.length)];
    setCurrentWeather((prev) => ({
      ...prev,
      temperature: randomWeather.temp,
      condition: randomWeather.condition,
      rainChance: randomWeather.rain,
      description: randomWeather.desc
    }));
  }, []);

  useEffect(() => {
    if (communityId) {
      loadWeatherAlerts();
      loadWeatherData();
    }
  }, [communityId, loadWeatherAlerts, loadWeatherData]);

  const createAlert = async (e) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Please log in to create alerts');
      return;
    }

    try {
      const alertData = {
        communityId,
        type: 'weather_alert',
        title: alertForm.title,
        message: alertForm.message,
        alertType: alertForm.type,
        priority: alertForm.priority,
        createdBy: user.displayName || user.email,
        createdById: user.uid,
        expiresAt: alertForm.expiresAt ? new Date(alertForm.expiresAt) : null,
        isActive: true
      };

      const response = await authenticatedFetch('/api/hub/emergency-alerts', {
        method: 'POST',
        body: JSON.stringify(alertData),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Alert created successfully!');
        setShowCreateAlert(false);
        setAlertForm({
          title: '',
          message: '',
          type: 'weather',
          priority: 'medium',
          expiresAt: ''
        });
        loadWeatherAlerts();
      } else {
        toast.error('Failed to create alert');
      }
    } catch (error) {
      console.error('Error creating alert:', error);
      toast.error('Error creating alert');
    }
  };

  const getWeatherIcon = (condition) => {
    switch (condition) {
      case 'sunny': return <Sun className="w-8 h-8 text-yellow-500" />;
      case 'partly-cloudy': return <Cloud className="w-8 h-8 text-gray-500" />;
      case 'cloudy': return <Cloud className="w-8 h-8 text-gray-600" />;
      case 'rainy': return <CloudRain className="w-8 h-8 text-blue-500" />;
      case 'drizzle': return <CloudDrizzle className="w-8 h-8 text-blue-400" />;
      default: return <Cloud className="w-8 h-8 text-gray-500" />;
    }
  };

  const getAlertIcon = (type) => {
    switch (type) {
      case 'flood': return <Droplets className="w-5 h-5" />;
      case 'power': return <Zap className="w-5 h-5" />;
      case 'weather': return <Cloud className="w-5 h-5" />;
      default: return <AlertTriangle className="w-5 h-5" />;
    }
  };

  const getAlertColor = (priority) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 border-red-500 text-red-800';
      case 'high': return 'bg-orange-100 border-orange-500 text-orange-800';
      case 'medium': return 'bg-yellow-100 border-yellow-500 text-yellow-800';
      case 'low': return 'bg-blue-100 border-blue-500 text-blue-800';
      default: return 'bg-gray-100 border-gray-500 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Weather */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {getWeatherIcon(currentWeather.condition)}
            <div>
              <h3 className="text-2xl font-bold">{currentWeather.temperature}°C</h3>
              <p className="text-blue-100">{currentWeather.description}</p>
              <div className="flex items-center space-x-1 text-sm text-blue-200 mt-1">
                <MapPin className="w-3 h-3" />
                <span>{currentWeather.location}</span>
              </div>
            </div>
          </div>
          
          <div className="text-right">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center space-x-1">
                <Droplets className="w-4 h-4" />
                <span>{currentWeather.humidity}% Humidity</span>
              </div>
              <div className="flex items-center space-x-1">
                <Wind className="w-4 h-4" />
                <span>{currentWeather.windSpeed} km/h</span>
              </div>
              <div className="flex items-center space-x-1">
                <CloudRain className="w-4 h-4" />
                <span>{currentWeather.rainChance}% Rain</span>
              </div>
              <div className="flex items-center space-x-1">
                <Eye className="w-4 h-4" />
                <span>{currentWeather.visibility} km</span>
              </div>
            </div>
            <button
              onClick={loadWeatherData}
              className="mt-3 px-3 py-1 bg-blue-400 hover:bg-blue-300 rounded text-sm"
            >
              Refresh Weather
            </button>
          </div>
        </div>
      </div>

      {/* Weather Warnings for Lagos */}
      {currentWeather.rainChance > 70 && (
        <div className="bg-orange-50 border-l-4 border-orange-400 p-4 rounded">
          <div className="flex items-center space-x-2">
            <Droplets className="w-5 h-5 text-orange-600" />
            <h4 className="font-semibold text-orange-800">Heavy Rain Expected</h4>
          </div>
          <p className="text-orange-700 text-sm mt-1">
            High chance of heavy rainfall. Be prepared for potential flooding in low-lying areas of Lagos.
          </p>
        </div>
      )}

      {/* Alert Management */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Community Weather Alerts</h2>
        <button
          onClick={() => setShowCreateAlert(true)}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          <span>Create Alert</span>
        </button>
      </div>

      {/* Create Alert Form */}
      {showCreateAlert && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Create Weather Alert</h3>
          <form onSubmit={createAlert} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Alert Title
                </label>
                <input
                  type="text"
                  value={alertForm.title}
                  onChange={(e) => setAlertForm({...alertForm, title: e.target.value})}
                  placeholder="e.g., Heavy Rain Warning"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Alert Type
                </label>
                <select
                  value={alertForm.type}
                  onChange={(e) => setAlertForm({...alertForm, type: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="weather">Weather Alert</option>
                  <option value="flood">Flood Warning</option>
                  <option value="power">Power Update</option>
                  <option value="general">General Alert</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message
              </label>
              <textarea
                value={alertForm.message}
                onChange={(e) => setAlertForm({...alertForm, message: e.target.value})}
                placeholder="Describe the weather situation and any recommended actions..."
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority Level
                </label>
                <select
                  value={alertForm.priority}
                  onChange={(e) => setAlertForm({...alertForm, priority: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expires At (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={alertForm.expiresAt}
                  onChange={(e) => setAlertForm({...alertForm, expiresAt: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex space-x-4 pt-4">
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
              >
                Create Alert
              </button>
              <button
                type="button"
                onClick={() => setShowCreateAlert(false)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Active Alerts */}
      <div className="space-y-4">
        {alerts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <Cloud className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No Active Weather Alerts</h3>
            <p className="text-gray-600 mb-4">
              Create weather alerts to notify your community about important conditions.
            </p>
            <button
              onClick={() => setShowCreateAlert(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Create First Alert
            </button>
          </div>
        ) : (
          alerts.map((alert) => (
            <div key={alert.id} className={`rounded-lg border-l-4 p-4 ${getAlertColor(alert.priority)}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className="mt-0.5">
                    {getAlertIcon(alert.alertType)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="font-semibold">{alert.title}</h4>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-white bg-opacity-50">
                        {alert.priority}
                      </span>
                    </div>
                    <p className="text-sm mb-2">{alert.message}</p>
                    <div className="text-xs opacity-75">
                      Created by {alert.createdBy} • {new Date(alert.createdAt).toLocaleString()}
                      {alert.expiresAt && (
                        <span> • Expires {new Date(alert.expiresAt).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                </div>
                <Bell className="w-5 h-5 opacity-50" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default WeatherAlerts;
