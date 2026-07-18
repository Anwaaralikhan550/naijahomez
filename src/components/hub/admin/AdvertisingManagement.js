'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, CheckCircle, Eye, Loader2, MapPin, Megaphone, MousePointerClick, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { authenticatedFetch } from '@/services/api';

function StatusPill({ status }) {
  const styles = {
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    paid_pending_review: 'bg-amber-50 text-amber-700 border-amber-200',
    payment_pending: 'bg-blue-50 text-blue-700 border-blue-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
    paused: 'bg-gray-50 text-gray-700 border-gray-200'
  };
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[status] || styles.payment_pending}`}>{status || 'unknown'}</span>;
}

export default function AdvertisingManagement() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [journeyMetrics, setJourneyMetrics] = useState([]);
  const [heatmapMetrics, setHeatmapMetrics] = useState([]);
  const [marketReports, setMarketReports] = useState([]);
  const [agentReports, setAgentReports] = useState([]);

  const stats = useMemo(() => campaigns.reduce((acc, campaign) => {
    acc.total += 1;
    acc.active += campaign.status === 'active' ? 1 : 0;
    acc.pending += campaign.status === 'paid_pending_review' ? 1 : 0;
    acc.impressions += Number(campaign.metrics?.impressions || 0);
    acc.clicks += Number(campaign.metrics?.clicks || 0);
    return acc;
  }, { total: 0, active: 0, pending: 0, impressions: 0, clicks: 0 }), [campaigns]);

  const funnelTotals = useMemo(() => {
    const latest = marketReports[0]?.funnelTotals;
    if (latest && typeof latest === 'object') return latest;
    return journeyMetrics.reduce((acc, item) => {
      acc[item.step || 'unknown'] = (acc[item.step || 'unknown'] || 0) + Number(item.count || 0);
      return acc;
    }, {});
  }, [journeyMetrics, marketReports]);

  const heatmapHotspots = useMemo(() => {
    if (Array.isArray(marketReports[0]?.heatmapHotspots)) return marketReports[0].heatmapHotspots;
    return [...heatmapMetrics]
      .sort((a, b) => Number(b.count || 0) - Number(a.count || 0))
      .slice(0, 8);
  }, [heatmapMetrics, marketReports]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await authenticatedFetch('/api/admin/advertising');
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Failed to load advertising data');
      setCampaigns(Array.isArray(result.campaigns) ? result.campaigns : []);
      setJourneyMetrics(Array.isArray(result.journeyMetrics) ? result.journeyMetrics : []);
      setHeatmapMetrics(Array.isArray(result.heatmapMetrics) ? result.heatmapMetrics : []);
      setMarketReports(Array.isArray(result.marketReports) ? result.marketReports : []);
      setAgentReports(Array.isArray(result.agentReports) ? result.agentReports : []);
    } catch (error) {
      toast.error(error.message || 'Failed to load advertising data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const runAction = async (payload, message) => {
    try {
      setSaving(true);
      const response = await authenticatedFetch('/api/admin/advertising', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Action failed');
      toast.success(message);
      await loadData();
    } catch (error) {
      toast.error(error.message || 'Action failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
        <p className="mt-3 text-gray-600">Loading advertising dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Advertising & Revenue</h3>
          <p className="text-gray-600">Approve campaigns, review performance, and generate weekly optimization reports.</p>
        </div>
        <button onClick={() => runAction({ action: 'generateReports' }, 'Weekly reports generated')} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
          <RefreshCw className="h-4 w-4" />
          Generate Reports
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ['Total campaigns', stats.total, Megaphone, 'text-blue-600'],
          ['Active', stats.active, ShieldCheck, 'text-emerald-600'],
          ['Impressions', stats.impressions, Eye, 'text-amber-600'],
          ['Clicks', stats.clicks, MousePointerClick, 'text-blue-600']
        ].map(([label, value, Icon, color]) => (
          <div key={label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <Icon className={`h-5 w-5 ${color}`} />
            <p className="mt-3 text-2xl font-bold text-blue-950">{Number(value).toLocaleString()}</p>
            <p className="text-sm text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-5 py-4">
          <p className="font-semibold text-gray-900">Campaign Review</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Campaign', 'Advertiser', 'Budget', 'Performance', 'Status', 'Actions'].map((head) => (
                  <th key={head} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <p className="font-medium text-gray-900">{campaign.title}</p>
                    <p className="text-xs text-gray-500">{campaign.slot}</p>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600">{campaign.userEmail || campaign.advertiserName}</td>
                  <td className="px-4 py-4 text-sm font-semibold text-blue-950">NGN {Number(campaign.budget || 0).toLocaleString()}</td>
                  <td className="px-4 py-4 text-sm text-gray-600">{campaign.metrics?.impressions || 0} views / {campaign.metrics?.clicks || 0} clicks</td>
                  <td className="px-4 py-4"><StatusPill status={campaign.status} /></td>
                  <td className="px-4 py-4">
                    <div className="flex gap-2">
                      <button onClick={() => runAction({ campaignId: campaign.id, action: 'approve' }, 'Campaign approved')} disabled={saving || campaign.status === 'active'} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"><CheckCircle className="h-4 w-4" /></button>
                      <button onClick={() => runAction({ campaignId: campaign.id, action: 'reject' }, 'Campaign rejected')} disabled={saving} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"><XCircle className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {campaigns.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-500">No campaigns yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="font-semibold text-gray-900">User Funnel</h4>
              <p className="text-sm text-gray-500">Aggregated journey events across landing, search, listing views, and contact clicks.</p>
            </div>
            <Activity className="h-5 w-5 text-blue-600" />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              ['Landing', funnelTotals.landing || 0],
              ['Search', funnelTotals.search || 0],
              ['Listing Views', funnelTotals.listing_view || 0],
              ['WhatsApp', funnelTotals.whatsapp_click || 0],
              ['Calls', funnelTotals.call_click || 0],
              ['Ad Clicks', funnelTotals.campaign_click || 0]
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-blue-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{label}</p>
                <p className="mt-2 text-2xl font-bold text-blue-950">{Number(value).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="font-semibold text-gray-900">Heatmap Hotspots</h4>
              <p className="text-sm text-gray-500">Privacy-light click clusters by page and UI element.</p>
            </div>
            <MousePointerClick className="h-5 w-5 text-amber-600" />
          </div>
          <div className="mt-4 space-y-2">
            {heatmapHotspots.slice(0, 6).map((item, index) => (
              <div key={`${item.page}-${item.element}-${index}`} className="rounded-xl bg-gray-50 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-medium text-gray-800">{item.element || 'Page click'}</span>
                  <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">{Number(item.count || 0).toLocaleString()}</span>
                </div>
                <p className="mt-1 truncate text-xs text-gray-500">{item.page || '/'} · {item.device || 'unknown'} · x{item.xBucket ?? '-'} y{item.yBucket ?? '-'}</p>
              </div>
            ))}
            {heatmapHotspots.length === 0 && <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">No heatmap data yet.</p>}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h4 className="font-semibold text-gray-900">Latest Market Engagement Report</h4>
          {(marketReports[0]?.hotLocations || []).slice(0, 8).map((item) => (
            <div key={item.location} className="mt-3 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
              <span className="inline-flex min-w-0 items-center gap-2 capitalize text-gray-700"><MapPin className="h-4 w-4 shrink-0 text-blue-500" /> <span className="truncate">{item.location}</span></span>
              <span className="font-semibold text-blue-700">{item.count}</span>
            </div>
          ))}
          {!marketReports[0] && <p className="mt-4 text-sm text-gray-500">No report generated yet.</p>}
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h4 className="font-semibold text-gray-900">Agent Activity Ranking</h4>
          {(agentReports[0]?.agents || []).slice(0, 8).map((agent) => (
            <div key={agent.userId} className="mt-3 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
              <span className="truncate text-gray-700">{agent.name || agent.email || agent.userId}</span>
              <span className="font-semibold text-blue-700">{Number(agent.score || agent.clicks || 0).toLocaleString()} score</span>
            </div>
          ))}
          {!agentReports[0] && <p className="mt-4 text-sm text-gray-500">No ranking generated yet.</p>}
        </div>
      </div>
    </div>
  );
}
