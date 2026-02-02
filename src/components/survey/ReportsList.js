'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Download,
  Eye,
  Trash2,
  Share2,
  AlertCircle,
  Clock,
  RefreshCw,
  HardDrive,
} from 'lucide-react';
import {
  listReportsLocally,
  downloadStoredReport,
  previewStoredReport,
  shareStoredReport,
  deleteReportLocally,
} from '@/lib/pdf-storage';

/**
 * ReportsList — Dedicated "Reports / PDFs" section.
 *
 * Reads from IndexedDB (local-first). Each row shows:
 *   - Title, filename, version, date, size, signature count
 *   - Actions: Preview (eye), Download, Share, Delete
 *
 * Delete is two-tap to prevent accidents and removes from both
 * IndexedDB and Firestore (via parent callback).
 */
export default function ReportsList({ surveyId = null, onDeleteRemote }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState(null); // reportId being acted on
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // ── Load reports from IndexedDB ────────────────────────────────
  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listReportsLocally(surveyId);
      setReports(list);
    } catch (err) {
      console.error('Failed to load reports from IndexedDB:', err);
    } finally {
      setLoading(false);
    }
  }, [surveyId]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // ── Actions ────────────────────────────────────────────────────
  const handlePreview = async (id) => {
    setActionInProgress(id);
    try {
      const ok = await previewStoredReport(id);
      if (!ok) alert('PDF not found in local storage. It may need to be regenerated.');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDownload = async (id) => {
    setActionInProgress(id);
    try {
      const ok = await downloadStoredReport(id);
      if (!ok) alert('PDF not found in local storage. It may need to be regenerated.');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleShare = async (id) => {
    setActionInProgress(id);
    try {
      await shareStoredReport(id);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDelete = async (id) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId((prev) => (prev === id ? null : prev)), 3000);
      return;
    }

    setActionInProgress(id);
    setConfirmDeleteId(null);
    try {
      // Delete from IndexedDB
      await deleteReportLocally(id);

      // Delete from Firestore via parent callback
      if (onDeleteRemote) {
        await onDeleteRemote(id);
      }

      // Refresh list
      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error('Failed to delete report:', err);
    } finally {
      setActionInProgress(null);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────
  const formatSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // ── Render ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-400 text-sm gap-2">
        <RefreshCw size={16} className="animate-spin" />
        Loading saved reports...
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="text-center py-8 space-y-2">
        <HardDrive size={32} className="mx-auto text-gray-300" />
        <p className="text-gray-400 text-sm">No saved reports yet.</p>
        <p className="text-gray-300 text-xs">
          Generate a PDF from a survey and it will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <HardDrive size={16} className="text-blue-600" />
          Saved Reports
          <span className="inline-flex items-center justify-center bg-blue-100 text-blue-700 text-xs font-bold rounded-full w-5 h-5">
            {reports.length}
          </span>
        </h3>
        <button
          onClick={loadReports}
          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <ul className="space-y-2">
        {reports.map((report) => {
          const isActing = actionInProgress === report.id;
          const isConfirming = confirmDeleteId === report.id;

          return (
            <li
              key={report.id}
              className={`border rounded-lg bg-white overflow-hidden transition-all ${
                isActing ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200'
              }`}
            >
              {/* Info row */}
              <div className="px-4 py-3 space-y-1">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-800 leading-tight">
                        {report.title}
                      </p>
                      <p className="text-xs text-gray-400">{report.filename}</p>
                    </div>
                  </div>
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full shrink-0">
                    v{report.version}
                  </span>
                </div>

                {/* Metadata chips */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Clock size={11} />
                    {report.createdAt
                      ? new Date(report.createdAt).toLocaleString()
                      : 'Unknown'}
                  </span>
                  <span>{formatSize(report.sizeBytes)}</span>
                  <span>
                    {report.signatureCount} sig{report.signatureCount !== 1 ? 's' : ''}
                  </span>
                  {report.hasBlob && (
                    <span className="text-green-500 flex items-center gap-0.5">
                      <HardDrive size={10} />
                      Local
                    </span>
                  )}
                </div>
              </div>

              {/* Action bar */}
              <div className="flex items-center border-t border-gray-100 divide-x divide-gray-100">
                <button
                  onClick={() => handlePreview(report.id)}
                  disabled={isActing}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-gray-600 hover:bg-gray-50 hover:text-blue-600 transition-colors disabled:opacity-40"
                  title="Preview"
                >
                  <Eye size={14} />
                  View
                </button>
                <button
                  onClick={() => handleDownload(report.id)}
                  disabled={isActing}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-gray-600 hover:bg-gray-50 hover:text-green-600 transition-colors disabled:opacity-40"
                  title="Download"
                >
                  <Download size={14} />
                  Download
                </button>
                <button
                  onClick={() => handleShare(report.id)}
                  disabled={isActing}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-gray-600 hover:bg-gray-50 hover:text-purple-600 transition-colors disabled:opacity-40"
                  title="Share"
                >
                  <Share2 size={14} />
                  Share
                </button>
                <button
                  onClick={() => handleDelete(report.id)}
                  disabled={isActing}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs transition-colors disabled:opacity-40 ${
                    isConfirming
                      ? 'bg-red-50 text-red-600 font-medium'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-red-600'
                  }`}
                  title={isConfirming ? 'Tap again to confirm' : 'Delete'}
                >
                  {isConfirming ? (
                    <>
                      <AlertCircle size={14} />
                      Confirm?
                    </>
                  ) : (
                    <>
                      <Trash2 size={14} />
                      Delete
                    </>
                  )}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
