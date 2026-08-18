'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { BellRing, CheckCircle2, Loader2, MessageCircle, MousePointerClick, RefreshCw, Send, Trash2, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { authenticatedFetch } from '@/services/api';

function StatusPill({ status }) {
  const styles = {
    pending: 'bg-gray-50 text-gray-700 border-gray-200',
    processing: 'bg-blue-50 text-blue-700 border-blue-200',
    sent: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    batched: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    claimed: 'bg-purple-50 text-purple-700 border-purple-200',
    deleted: 'bg-red-50 text-red-700 border-red-200',
    suppressed: 'bg-amber-50 text-amber-700 border-amber-200',
    failed: 'bg-red-50 text-red-700 border-red-200'
  };
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[status] || styles.pending}`}>{status || 'unknown'}</span>;
}

function StepBadge({ done, label }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${done ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-400'}`}>
      {done ? <CheckCircle2 className="h-3 w-3" /> : null}
      {label}
    </span>
  );
}

function formatDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
}

export default function AgentOutreachMonitor() {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (search.trim()) params.set('phone', search.trim());

      const response = await authenticatedFetch(`/api/admin/outreach-funnel?${params.toString()}`);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Failed to load outreach funnel');
      setEntries(Array.isArray(result.entries) ? result.entries : []);
      setSummary(result.summary || null);
    } catch (error) {
      toast.error(error.message || 'Failed to load outreach funnel');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading && !entries.length) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
        <p className="mt-3 text-gray-600">Loading agent outreach funnel...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Agent Outreach</h3>
          <p className="text-gray-600">Track WhatsApp outreach to scraped-listing agents: sent, opened, claimed, or deleted.</p>
        </div>
        <button onClick={loadData} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        {[
          ['Sent (7 days)', summary?.sentWeek ?? 0, Send, 'text-blue-600'],
          ['Link opened', `${summary?.openRatePct ?? 0}%`, MousePointerClick, 'text-amber-600'],
          ['Claimed', `${summary?.claimRatePct ?? 0}%`, UserCheck, 'text-purple-600'],
          ['Deleted', `${summary?.deleteRatePct ?? 0}%`, Trash2, 'text-red-600'],
          ['Reminded', summary?.remindedTotal ?? 0, BellRing, 'text-teal-600']
        ].map(([label, value, Icon, color]) => (
          <div key={label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <Icon className={`h-5 w-5 ${color}`} />
            <p className="mt-3 text-2xl font-bold text-blue-950">{value}</p>
            <p className="text-sm text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          {['all', 'pending', 'sent', 'batched', 'claimed', 'deleted', 'suppressed', 'failed'].map((value) => (
            <option key={value} value={value}>{value === 'all' ? 'All statuses' : value}</option>
          ))}
        </select>
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search agent name or phone"
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Agent', 'Listing', 'Status', 'Sent', 'Funnel', 'Claimed', 'New listings since'].map((head) => (
                  <th key={head} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((entry) => (
                <tr key={entry.queueId} className="hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <p className="font-medium text-gray-900">{entry.agentName || 'Unknown agent'}</p>
                    <p className="text-xs text-gray-500">{entry.phone}</p>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600">
                    <p className="max-w-[220px] truncate">{entry.listingTitle || entry.advertId}</p>
                    <p className="text-xs text-gray-400">{entry.listingLocation}</p>
                  </td>
                  <td className="px-4 py-4"><StatusPill status={entry.status} /></td>
                  <td className="px-4 py-4 text-xs text-gray-500">{formatDateTime(entry.sentAt) || '—'}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      <StepBadge done={Boolean(entry.linkOpenedAt)} label="Opened" />
                      <StepBadge done={Boolean(entry.claimPageReachedAt)} label="Claim page" />
                      <StepBadge done={Boolean(entry.loginRequiredAt || entry.adClaimedAt)} label="Logged in" />
                      <StepBadge done={Boolean(entry.adDeletedAt)} label="Deleted" />
                    </div>
                  </td>
                  <td className="px-4 py-4 text-xs text-gray-500">{formatDateTime(entry.adClaimedAt || entry.claimedAt) || '—'}</td>
                  <td className="px-4 py-4 text-sm font-semibold text-blue-950">
                    {entry.newListingsSinceClaim > 0 ? entry.newListingsSinceClaim : '—'}
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-500">No outreach activity yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="flex items-center gap-2 text-xs text-gray-400">
        <MessageCircle className="h-3.5 w-3.5" />
        &quot;Logged in&quot; is inferred: either the agent was redirected to login from the claim page, or they reached the claim-complete step (which requires being logged in).
      </p>
    </div>
  );
}
