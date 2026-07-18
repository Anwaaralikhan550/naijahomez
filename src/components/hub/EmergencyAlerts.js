'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Shield,
  Clock,
  CheckCircle,
  RefreshCw,
  Phone,
  Mail,
  Info
} from 'lucide-react';
import { authenticatedFetch } from '@/services/api';
import toast from 'react-hot-toast';
import { normalizeText, sortAlertsByPriority } from '@/lib/search';

const EmergencyAlerts = ({ communityId }) => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadEmergencyAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await authenticatedFetch(`/api/hub/alerts?communityId=${communityId}&priority=urgent`);
      const result = await response.json();

      if (response.ok) {
        setAlerts(sortAlertsByPriority(result.alerts || []));
      }
    } catch (error) {
      console.error('Error loading emergency alerts:', error);
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  useEffect(() => {
    if (communityId) {
      loadEmergencyAlerts();
    }
  }, [communityId, loadEmergencyAlerts]);

  useEffect(() => {
    if (!communityId) return undefined;
    const interval = setInterval(loadEmergencyAlerts, 10000);
    return () => clearInterval(interval);
  }, [communityId, loadEmergencyAlerts]);

  const formatDate = (date) => {
    if (!date) return '';
    const parsedDate = date?.toDate ? date.toDate() : new Date(date);
    if (Number.isNaN(parsedDate.getTime())) return '';
    return `${parsedDate.toLocaleDateString()} ${parsedDate.toLocaleTimeString()}`;
  };

  const getAlertIcon = (level) => {
    const normalizedLevel = normalizeText(level);
    if (normalizedLevel === 'critical') return <AlertTriangle className="h-6 w-6 text-red-600" />;
    if (normalizedLevel === 'high') return <AlertTriangle className="h-6 w-6 text-orange-600" />;
    if (normalizedLevel === 'medium') return <Shield className="h-6 w-6 text-yellow-600" />;
    if (normalizedLevel === 'low') return <Info className="h-6 w-6 text-blue-600" />;
    return <AlertTriangle className="h-6 w-6 text-gray-600" />;
  };

  const getAlertColor = (level) => {
    const normalizedLevel = normalizeText(level);
    if (normalizedLevel === 'critical') return 'border-l-red-500 bg-red-50';
    if (normalizedLevel === 'high') return 'border-l-orange-500 bg-orange-50';
    if (normalizedLevel === 'medium') return 'border-l-yellow-500 bg-yellow-50';
    if (normalizedLevel === 'low') return 'border-l-blue-500 bg-blue-50';
    return 'border-l-gray-500 bg-gray-50';
  };

  const getLevelBadgeColor = (level) => {
    const normalizedLevel = normalizeText(level);
    if (normalizedLevel === 'critical') return 'bg-red-100 text-red-800';
    if (normalizedLevel === 'high') return 'bg-orange-100 text-orange-800';
    if (normalizedLevel === 'medium') return 'bg-yellow-100 text-yellow-800';
    if (normalizedLevel === 'low') return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-800';
  };

  const activeAlerts = sortAlertsByPriority(alerts.filter((alert) => alert.isActive));
  const historicalAlerts = sortAlertsByPriority(alerts.filter((alert) => !alert.isActive));
  const urgentAlerts = activeAlerts.filter((alert) => {
    const level = normalizeText(alert?.alertLevel);
    return level === 'critical' || level === 'high';
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Emergency Alerts</h2>
          <p className="text-gray-600">Stay informed about community safety</p>
        </div>
        <button
          onClick={loadEmergencyAlerts}
          disabled={loading}
          className="flex items-center rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {urgentAlerts.length > 0 && (
        <div className="rounded-xl border-2 border-red-500 bg-gradient-to-r from-red-600 via-red-500 to-yellow-500 p-4 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 animate-pulse" />
              <h3 className="text-lg font-extrabold uppercase tracking-wide">Urgent Alerts</h3>
            </div>
            <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-semibold">
              {urgentAlerts.length} active
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {urgentAlerts.slice(0, 3).map((alert) => (
              <div key={alert.id} className="rounded-lg bg-white/15 px-3 py-2">
                <p className="font-semibold">{alert.title}</p>
                {alert.message && <p className="text-sm opacity-95">{alert.message}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeAlerts.length > 0 && (
        <div className="space-y-4">
          <h3 className="flex items-center text-lg font-semibold text-red-600">
            <AlertTriangle className="mr-2 h-5 w-5" />
            Active Alerts ({activeAlerts.length})
          </h3>

          {activeAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-lg border-l-4 p-6 shadow-md ${getAlertColor(alert.alertLevel)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  {getAlertIcon(alert.alertLevel)}
                  <div className="flex-1">
                    <div className="mb-2 flex items-center space-x-2">
                      <h4 className="text-lg font-semibold text-gray-900">{alert.title}</h4>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${getLevelBadgeColor(alert.alertLevel)}`}
                      >
                        {normalizeText(alert.alertLevel).toUpperCase() || 'UNKNOWN'}
                      </span>
                    </div>
                    <p className="mb-3 text-gray-700">{alert.message}</p>

                    {alert.actionRequired && (
                      <div className="mb-3 rounded-md bg-white p-3">
                        <p className="mb-1 text-sm font-medium text-gray-900">Action Required:</p>
                        <p className="text-sm text-gray-700">{alert.actionRequired}</p>
                      </div>
                    )}

                    {alert.contactInfo && (
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        {alert.contactInfo.phone && (
                          <div className="flex items-center">
                            <Phone className="mr-1 h-4 w-4" />
                            <a href={`tel:${alert.contactInfo.phone}`} className="hover:text-blue-600">
                              {alert.contactInfo.phone}
                            </a>
                          </div>
                        )}
                        {alert.contactInfo.email && (
                          <div className="flex items-center">
                            <Mail className="mr-1 h-4 w-4" />
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
                    <Clock className="mr-1 h-4 w-4" />
                    {formatDate(alert.createdAt)}
                  </div>
                  {alert.reference && <div className="mt-1">Ref: {alert.reference}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeAlerts.length === 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
          <CheckCircle className="mx-auto mb-3 h-12 w-12 text-green-600" />
          <h3 className="mb-2 text-lg font-semibold text-green-900">All Clear</h3>
          <p className="text-green-700">There are no active emergency alerts at this time.</p>
        </div>
      )}

      {historicalAlerts.length > 0 && (
        <div className="space-y-4">
          <h3 className="flex items-center text-lg font-semibold text-gray-700">
            <Clock className="mr-2 h-5 w-5" />
            Recent Alerts
          </h3>

          <div className="rounded-lg bg-white shadow">
            <div className="divide-y">
              {historicalAlerts.slice(0, 10).map((alert) => (
                <div key={alert.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className="opacity-50">{getAlertIcon(alert.alertLevel)}</div>
                      <div className="flex-1">
                        <div className="mb-1 flex items-center space-x-2">
                          <h5 className="font-medium text-gray-900">{alert.title}</h5>
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-medium opacity-75 ${getLevelBadgeColor(alert.alertLevel)}`}
                          >
                            {normalizeText(alert.alertLevel).toUpperCase() || 'UNKNOWN'}
                          </span>
                          <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
                            RESOLVED
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{alert.message}</p>
                      </div>
                    </div>

                    <div className="text-right text-xs text-gray-500">
                      <div>{formatDate(alert.createdAt)}</div>
                      {alert.deactivatedAt && <div className="mt-1">Resolved: {formatDate(alert.deactivatedAt)}</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Emergency Contacts</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg bg-red-50 p-4 text-center">
            <Phone className="mx-auto mb-2 h-8 w-8 text-red-600" />
            <h4 className="font-medium text-gray-900">Emergency Services</h4>
            <a href="tel:911" className="text-lg font-bold text-red-600">
              911
            </a>
          </div>
          <div className="rounded-lg bg-blue-50 p-4 text-center">
            <Shield className="mx-auto mb-2 h-8 w-8 text-blue-600" />
            <h4 className="font-medium text-gray-900">Security</h4>
            <a href="tel:+234-xxx-xxxx" className="font-bold text-blue-600">
              +234-XXX-XXXX
            </a>
          </div>
          <div className="rounded-lg bg-green-50 p-4 text-center">
            <Phone className="mx-auto mb-2 h-8 w-8 text-green-600" />
            <h4 className="font-medium text-gray-900">Estate Office</h4>
            <a href="tel:+234-xxx-xxxx" className="font-bold text-green-600">
              +234-XXX-XXXX
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmergencyAlerts;
