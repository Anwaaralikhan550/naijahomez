'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { BarChart3, Calendar, CreditCard, ImagePlus, Loader2, Megaphone, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { authenticatedFetch } from '@/services/api';
import uploadFile from '@/utils/firebaseStorageUpload';

const SLOT_OPTIONS = [
  { id: 'home_between_listings', label: 'Home Page Sponsored Card', min: 5000 },
  { id: 'search_sponsored_card', label: 'Search Results Sponsored Card', min: 7500 },
  { id: 'property_detail_sidebar', label: 'Property Detail Sidebar', min: 10000 },
  { id: 'market_insights_banner', label: 'Market Insights Banner', min: 5000 }
];

const emptyForm = {
  title: '',
  description: '',
  creativeUrl: '',
  destinationUrl: '',
  advertiserName: '',
  ctaLabel: 'Learn more',
  slot: 'home_between_listings',
  budget: 5000,
  durationDays: 7,
  locations: 'Lagos, Abuja, Port Harcourt',
  propertyCategories: 'properties'
};

function StatusPill({ status }) {
  const styles = {
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    paid_pending_review: 'bg-amber-50 text-amber-700 border-amber-200',
    payment_pending: 'bg-blue-50 text-blue-700 border-blue-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
    paused: 'bg-gray-50 text-gray-700 border-gray-200'
  };
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[status] || styles.payment_pending}`}>{status || 'draft'}</span>;
}

export default function AdvertiserDashboard() {
  const [campaigns, setCampaigns] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const loadCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      const response = await authenticatedFetch('/api/advertising/campaigns');
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Failed to load campaigns');
      setCampaigns(Array.isArray(result.campaigns) ? result.campaigns : []);
    } catch (error) {
      toast.error(error.message || 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const txRef = params.get('tx_ref');
    const transactionId = params.get('transaction_id');
    if (!txRef && !transactionId) return;

    authenticatedFetch('/api/advertising/payments/verify', {
      method: 'POST',
      body: JSON.stringify({ txRef, transactionId })
    })
      .then((response) => response.json().then((result) => ({ response, result })))
      .then(({ response, result }) => {
        if (!response.ok || !result.success) throw new Error(result.error || 'Payment verification failed');
        toast.success('Campaign payment verified. It is now pending admin review.');
        loadCampaigns();
      })
      .catch((error) => toast.error(error.message || 'Payment verification failed'));
  }, [loadCampaigns]);

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const result = await uploadFile(file, 'ad-creatives');
      setForm((prev) => ({ ...prev, creativeUrl: result.url }));
      toast.success('Creative uploaded');
    } catch (error) {
      toast.error(error.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const createCampaign = async () => {
    try {
      setSaving(true);
      const response = await authenticatedFetch('/api/advertising/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          targeting: {
            locations: form.locations.split(',').map((item) => item.trim()).filter(Boolean),
            propertyCategories: form.propertyCategories.split(',').map((item) => item.trim()).filter(Boolean)
          }
        })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Failed to create campaign');
      toast.success('Campaign created. Continue to payment.');
      setForm(emptyForm);
      await loadCampaigns();
    } catch (error) {
      toast.error(error.message || 'Failed to create campaign');
    } finally {
      setSaving(false);
    }
  };

  const payCampaign = async (campaignId) => {
    try {
      setSaving(true);
      const response = await authenticatedFetch('/api/advertising/payments/initialize', {
        method: 'POST',
        body: JSON.stringify({ campaignId })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Failed to start payment');
      window.location.href = result.link;
    } catch (error) {
      toast.error(error.message || 'Failed to start payment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-cyan-50 p-5">
        <div className="flex items-start gap-3">
          <Megaphone className="mt-1 h-6 w-6 text-blue-600" />
          <div>
            <h3 className="text-xl font-semibold text-blue-950">Advertiser Hub</h3>
            <p className="mt-1 text-sm text-gray-600">Create sponsored campaigns, pay via Flutterwave, and track performance.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h4 className="font-semibold text-gray-900">Create campaign</h4>
          <div className="mt-4 space-y-3">
            {['title', 'description', 'destinationUrl', 'advertiserName', 'ctaLabel'].map((field) => (
              <input
                key={field}
                value={form[field]}
                onChange={(event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))}
                placeholder={field === 'destinationUrl' ? 'https://...' : field}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            ))}
            <select
              value={form.slot}
              onChange={(event) => {
                const option = SLOT_OPTIONS.find((item) => item.id === event.target.value);
                setForm((prev) => ({ ...prev, slot: event.target.value, budget: Math.max(Number(prev.budget || 0), option?.min || 5000) }));
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              {SLOT_OPTIONS.map((slot) => <option key={slot.id} value={slot.id}>{slot.label}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input type="number" value={form.budget} onChange={(event) => setForm((prev) => ({ ...prev, budget: event.target.value }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" placeholder="Budget" />
              <input type="number" value={form.durationDays} onChange={(event) => setForm((prev) => ({ ...prev, durationDays: event.target.value }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" placeholder="Days" />
            </div>
            <input value={form.locations} onChange={(event) => setForm((prev) => ({ ...prev, locations: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" placeholder="Locations, comma-separated" />
            <input value={form.propertyCategories} onChange={(event) => setForm((prev) => ({ ...prev, propertyCategories: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" placeholder="Categories, comma-separated" />
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 hover:bg-blue-100">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              Upload banner
              <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            </label>
            {form.creativeUrl && <img src={form.creativeUrl} alt="Ad creative preview" className="h-32 w-full rounded-xl object-cover" />}
            <button onClick={createCampaign} disabled={saving || uploading} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
              <Send className="h-4 w-4" />
              Create campaign
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h4 className="font-semibold text-gray-900">Your campaigns</h4>
          {loading ? (
            <div className="p-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-600" /></div>
          ) : campaigns.length === 0 ? (
            <p className="mt-4 rounded-xl bg-gray-50 p-5 text-center text-gray-500">No campaigns yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {campaigns.map((campaign) => (
                <div key={campaign.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">{campaign.title}</p>
                      <p className="mt-1 text-sm text-gray-500">{campaign.slot}</p>
                    </div>
                    <StatusPill status={campaign.status} />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="rounded-lg bg-white p-3"><BarChart3 className="mx-auto h-4 w-4 text-blue-600" /><p className="font-bold text-blue-950">{campaign.metrics?.impressions || 0}</p><p className="text-xs text-gray-500">Views</p></div>
                    <div className="rounded-lg bg-white p-3"><Megaphone className="mx-auto h-4 w-4 text-emerald-600" /><p className="font-bold text-blue-950">{campaign.metrics?.clicks || 0}</p><p className="text-xs text-gray-500">Clicks</p></div>
                    <div className="rounded-lg bg-white p-3"><Calendar className="mx-auto h-4 w-4 text-amber-600" /><p className="font-bold text-blue-950">{campaign.durationDays}</p><p className="text-xs text-gray-500">Days</p></div>
                  </div>
                  {campaign.paymentStatus !== 'paid' && (
                    <button onClick={() => payCampaign(campaign.id)} disabled={saving} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
                      <CreditCard className="h-4 w-4" />
                      Pay NGN {Number(campaign.budget || 0).toLocaleString()}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
