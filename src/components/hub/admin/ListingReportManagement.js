'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink, Flag, Loader2, RefreshCw, ShieldX, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { authenticatedFetch } from '@/services/api';

function formatDate(dateValue) {
  if (!dateValue) return 'Unknown';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString();
}

function resolveListingHref(report) {
  if (report?.listingUrl) return report.listingUrl;

  const idOrSlug = report?.listingSlug || report?.listingId;
  if (!idOrSlug) return null;

  const type = String(report?.listingType || report?.collectionName || '').toLowerCase();

  if (type.includes('property')) return `/property/${idOrSlug}`;
  if (type.includes('housemate')) return `/housemate/${idOrSlug}`;
  if (type.includes('notice')) return `/noticeboard/${idOrSlug}`;
  if (type.includes('market')) return `/marketplace/${idOrSlug}`;
  if (type.includes('trade') || type.includes('service')) return `/tradespeople/${idOrSlug}`;

  return null;
}

export default function ListingReportManagement() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actingOnId, setActingOnId] = useState('');

  const pendingCount = useMemo(() => reports.length, [reports]);

  const loadReports = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await authenticatedFetch('/api/reports/pending?status=pending');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || 'Failed to fetch reports');
      }

      setReports(result?.reports || []);
    } catch (err) {
      console.error('Error loading listing reports:', err);
      setError(err.message || 'Failed to load reports');
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const resolveReport = async (reportId, action) => {
    try {
      if (action === 'delete') {
        const confirmed = window.confirm('Delete/hide this listing and resolve the report?');
        if (!confirmed) return;
      }

      setActingOnId(reportId);

      const response = await authenticatedFetch(`/api/reports/${reportId}`, {
        method: 'PATCH',
        body: JSON.stringify({ action })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || 'Failed to update report');
      }

      if (action === 'dismiss') {
        toast.success('Report dismissed.');
      } else if (action === 'delete') {
        toast.success('Listing deleted/hidden and report resolved.');
      } else {
        toast.success('Listing flagged and report resolved.');
      }
      setReports((prev) => prev.filter((report) => report.id !== reportId));
    } catch (err) {
      toast.error(err.message || 'Action failed');
    } finally {
      setActingOnId('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Listing Reports</h3>
          <p className="text-sm text-gray-500">Pending abuse, scam, and quality reports from users.</p>
        </div>
        <button
          type="button"
          onClick={loadReports}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-gray-600">
          Pending reports: <span className="font-semibold text-gray-900">{pendingCount}</span>
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="rounded-lg bg-white p-8 text-center shadow">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
          <p className="mt-3 text-sm text-gray-500">Loading reports...</p>
        </div>
      )}

      {!loading && !error && reports.length === 0 && (
        <div className="rounded-lg bg-white p-8 text-center shadow">
          <AlertTriangle className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-600">No pending reports right now.</p>
        </div>
      )}

      {!loading && reports.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Reason</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Listing</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Reporter</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Submitted</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports.map((report) => {
                const listingHref = resolveListingHref(report);
                const actionBusy = actingOnId === report.id;

                return (
                  <tr key={report.id}>
                    <td className="px-4 py-4 align-top">
                      <span className="inline-flex rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                        {report.reason || 'Unspecified'}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <p className="font-medium text-gray-900">{report.listingTitle || 'Untitled listing'}</p>
                      <p className="text-xs text-gray-500">ID: {report.listingId}</p>
                      {report.description && (
                        <p className="mt-1 text-xs text-gray-600">{report.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-4 align-top text-gray-600">
                      {report.reporterId || 'Anonymous'}
                    </td>
                    <td className="px-4 py-4 align-top text-gray-600">
                      {formatDate(report.createdAt)}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex justify-end gap-2">
                        {listingHref ? (
                          <a
                            href={listingHref}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            View Listing
                          </a>
                        ) : (
                          <span className="inline-flex items-center rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-400">
                            No URL
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => resolveReport(report.id, 'dismiss')}
                          disabled={actionBusy}
                          className="inline-flex items-center gap-1 rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-60"
                        >
                          {actionBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldX className="h-3.5 w-3.5" />}
                          Dismiss
                        </button>

                        <button
                          type="button"
                          onClick={() => resolveReport(report.id, 'flag')}
                          disabled={actionBusy}
                          className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
                        >
                          {actionBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Flag className="h-3.5 w-3.5" />}
                          Flag
                        </button>

                        <button
                          type="button"
                          onClick={() => resolveReport(report.id, 'delete')}
                          disabled={actionBusy}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                        >
                          {actionBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          Delete Listing
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
