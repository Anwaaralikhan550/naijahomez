'use client';
import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Shield, 
  Clock, 
  CheckCircle,
  XCircle,
  RefreshCw,
  Phone,
  Mail,
  Info
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authenticatedFetch } from '@/services/api';
import toast from 'react-hot-toast';
import { useFirestoreUpdates } from '@/hooks/useFirestoreQuery';
import { db } from '@/lib/firebase-client';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';

const EmergencyAlerts = ({ communityId }) => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);

  // Create Firestore query for real-time alert updates
  const alertsQuery = communityId
    ? query(
        collection(db, 'emergencyAlerts'),
        where('communityId', '==', communityId),
        orderBy('createdAt', 'desc'),
        limit(50)
      )
    : null;

  // Use Firestore client SDK for real-time alert updates
  const { isListening } = useFirestoreUpdates(
    alertsQuery,
    (changes) => {
      // Handle real-time alert updates
      setAlerts(currentAlerts => {
        let updated = [...currentAlerts];
        
        changes.forEach(change => {
          if (change.type === 'added') {
            // Add new alert if it doesn't exist
            const exists = updated.some(a => a.id === change.doc.id);
            if (!exists) {
              updated.unshift(change.doc);
              // Show urgent notification for new emergency alert
              toast.error(
                <div>
                  <strong>🚨 EMERGENCY ALERT</strong>
                  <p>{change.doc.title}</p>
                </div>,
                { duration: 10000 }
              );
            }
          } else if (change.type === 'modified') {
            const index = updated.findIndex(a => a.id === change.doc.id);
            if (index !== -1) {
              updated[index] = change.doc;
            }
          } else if (change.type === 'removed') {
            updated = updated.filter(a => a.id !== change.doc.id);
          }
        });
        
        return updated.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      });
    }
  );

  useEffect(() => {
    if (communityId) {
      loadEmergencyAlerts(); // Load initial alerts
    }
  }, [communityId]);

  const loadEmergencyAlerts = async () => {
    try {
      setLoading(true);
      const response = await authenticatedFetch(`/api/hub/alerts?communityId=${communityId}`);
      const result = await response.json();

      if (response.ok) {
        setAlerts(result.alerts || []);
      }
    } catch (error) {
      console.error('Error loading emergency alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
  };

  const getAlertIcon = (level) => {
    switch (level) {
      case 'critical': return <AlertTriangle className="w-6 h-6 text-red-600" />;
      case 'high': return <AlertTriangle className="w-6 h-6 text-orange-600" />;
      case 'medium': return <Shield className="w-6 h-6 text-yellow-600" />;
      case 'low': return <Info className="w-6 h-6 text-blue-600" />;
      default: return <AlertTriangle className="w-6 h-6 text-gray-600" />;
    }
  };

  const getAlertColor = (level) => {
    switch (level) {
      case 'critical': return 'border-l-red-500 bg-red-50';
      case 'high': return 'border-l-orange-500 bg-orange-50';
      case 'medium': return 'border-l-yellow-500 bg-yellow-50';
      case 'low': return 'border-l-blue-500 bg-blue-50';
      default: return 'border-l-gray-500 bg-gray-50';
    }
  };

  const getLevelBadgeColor = (level) => {
    switch (level) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const activeAlerts = alerts.filter(alert => alert.isActive);
  const historicalAlerts = alerts.filter(alert => !alert.isActive);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Emergency Alerts</h2>
          <p className="text-gray-600">Stay informed about community safety</p>
        </div>
        <button
          onClick={loadEmergencyAlerts}
          disabled={loading}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Active Alerts */}
      {activeAlerts.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-red-600 flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            Active Alerts ({activeAlerts.length})
          </h3>
          
          {activeAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`border-l-4 p-6 rounded-lg shadow-md ${getAlertColor(alert.alertLevel)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  {getAlertIcon(alert.alertLevel)}
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h4 className="text-lg font-semibold text-gray-900">{alert.title}</h4>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getLevelBadgeColor(alert.alertLevel)}`}>
                        {alert.alertLevel.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-gray-700 mb-3">{alert.message}</p>
                    
                    {alert.actionRequired && (
                      <div className="bg-white p-3 rounded-md mb-3">
                        <p className="text-sm font-medium text-gray-900 mb-1">Action Required:</p>
                        <p className="text-sm text-gray-700">{alert.actionRequired}</p>
                      </div>
                    )}
                    
                    {alert.contactInfo && (
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        {alert.contactInfo.phone && (
                          <div className="flex items-center">
                            <Phone className="w-4 h-4 mr-1" />
                            <a href={`tel:${alert.contactInfo.phone}`} className="hover:text-blue-600">
                              {alert.contactInfo.phone}
                            </a>
                          </div>
                        )}
                        {alert.contactInfo.email && (
                          <div className="flex items-center">
                            <Mail className="w-4 h-4 mr-1" />
                            <a href={`mailto:${alert.contactInfo.email}`} className="hover:text-blue-600">
                              {alert.contactInfo.email}
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="text-right text-sm text-gray-500">
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    {formatDate(alert.createdAt)}
                  </div>
                  {alert.reference && (
                    <div className="mt-1">
                      Ref: {alert.reference}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No Active Alerts */}
      {activeAlerts.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-green-900 mb-2">All Clear</h3>
          <p className="text-green-700">There are no active emergency alerts at this time.</p>
        </div>
      )}

      {/* Historical Alerts */}
      {historicalAlerts.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-700 flex items-center">
            <Clock className="w-5 h-5 mr-2" />
            Recent Alerts
          </h3>
          
          <div className="bg-white rounded-lg shadow">
            <div className="divide-y">
              {historicalAlerts.slice(0, 10).map((alert) => (
                <div key={alert.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className="opacity-50">
                        {getAlertIcon(alert.alertLevel)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h5 className="font-medium text-gray-900">{alert.title}</h5>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full opacity-75 ${getLevelBadgeColor(alert.alertLevel)}`}>
                            {alert.alertLevel.toUpperCase()}
                          </span>
                          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                            RESOLVED
                          </span>
                        </div>
                        <p className="text-gray-600 text-sm">{alert.message}</p>
                      </div>
                    </div>
                    
                    <div className="text-right text-xs text-gray-500">
                      <div>{formatDate(alert.createdAt)}</div>
                      {alert.deactivatedAt && (
                        <div className="mt-1">
                          Resolved: {formatDate(alert.deactivatedAt)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Emergency Contacts */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Emergency Contacts</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <Phone className="w-8 h-8 text-red-600 mx-auto mb-2" />
            <h4 className="font-medium text-gray-900">Emergency Services</h4>
            <a href="tel:911" className="text-red-600 font-bold text-lg">911</a>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <Shield className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <h4 className="font-medium text-gray-900">Security</h4>
            <a href="tel:+234-xxx-xxxx" className="text-blue-600 font-bold">+234-XXX-XXXX</a>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <Phone className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <h4 className="font-medium text-gray-900">Estate Office</h4>
            <a href="tel:+234-xxx-xxxx" className="text-green-600 font-bold">+234-XXX-XXXX</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmergencyAlerts;