'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAuthHeaders } from '@/services/api';

const REPORT_REASONS = [
  'Scam',
  'Incorrect Price',
  'Sold/Unavailable',
  'Offensive'
];

const DESCRIPTION_MAX_LENGTH = 280;
const COOLDOWN_SECONDS = 60;

function sanitizeInput(value) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getCooldownStorageKey(listingId) {
  return `listing-report-cooldown:${listingId}`;
}

function normalizeListingLinks(listing = {}) {
  const rawPath = sanitizeInput(listing.listingPath || '');
  const rawUrl = sanitizeInput(listing.listingUrl || '');

  if (rawUrl.startsWith('/')) {
    return {
      listingPath: rawPath || rawUrl,
      listingUrl: ''
    };
  }

  return {
    listingPath: rawPath,
    listingUrl: rawUrl
  };
}

export default function ListingReportModal({ isOpen, onClose, listing }) {
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  const listingId = listing?.listingId || listing?.id || '';
  const isCoolingDown = cooldownRemaining > 0;

  const cooldownKey = useMemo(() => getCooldownStorageKey(listingId || 'unknown'), [listingId]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const updateCooldown = () => {
      try {
        const storedUntil = Number(localStorage.getItem(cooldownKey) || '0');
        const remainingMs = Math.max(0, storedUntil - Date.now());
        setCooldownRemaining(Math.ceil(remainingMs / 1000));
      } catch {
        setCooldownRemaining(0);
      }
    };

    updateCooldown();
    const timer = setInterval(updateCooldown, 1000);
    return () => clearInterval(timer);
  }, [isOpen, cooldownKey]);

  useEffect(() => {
    if (!isOpen) {
      setReason('');
      setDescription('');
      setSubmitting(false);
      setCooldownRemaining(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const descriptionValue = description.slice(0, DESCRIPTION_MAX_LENGTH);
  const canSubmit = Boolean(reason) && !submitting && !isCoolingDown && Boolean(listingId);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!reason) {
      toast.error('Please select a reason for this report.');
      return;
    }

    if (!listingId) {
      toast.error('Listing information is incomplete.');
      return;
    }

    if (isCoolingDown) {
      toast.error(`Please wait ${cooldownRemaining}s before submitting again.`);
      return;
    }

    setSubmitting(true);

    try {
      const headers = await getAuthHeaders();
      const links = normalizeListingLinks(listing);
      const payload = {
        listingId: sanitizeInput(listingId),
        listingTitle: sanitizeInput(listing?.listingTitle || listing?.title || 'Untitled Listing'),
        listingType: sanitizeInput(listing?.listingType || ''),
        collectionName: sanitizeInput(listing?.collectionName || ''),
        listingSlug: sanitizeInput(listing?.listingSlug || listing?.slug || ''),
        listingPath: links.listingPath,
        listingUrl: links.listingUrl,
        reason: sanitizeInput(reason),
        description: sanitizeInput(descriptionValue)
      };

      const response = await fetch('/api/reports', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || 'Failed to submit report.');
      }

      try {
        const cooldownUntil = Date.now() + (COOLDOWN_SECONDS * 1000);
        localStorage.setItem(cooldownKey, String(cooldownUntil));
      } catch {
        // Storage can fail in private mode; submit should still succeed.
      }

      toast.success('Report submitted. Thank you for helping keep the platform safe.');
      onClose?.();
    } catch (error) {
      toast.error(error.message || 'Unable to submit report right now.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget && !submitting) {
          onClose?.();
        }
      }}
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-amber-100 p-2 text-amber-600">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Report this ad</h3>
              <p className="text-sm text-slate-500">We review every report for policy and safety checks.</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="report-reason">
              Reason
            </label>
            <select
              id="report-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
              required
            >
              <option value="">Select a reason</option>
              {REPORT_REASONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="report-description">
              Description (optional)
            </label>
            <textarea
              id="report-description"
              value={descriptionValue}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              maxLength={DESCRIPTION_MAX_LENGTH}
              placeholder="Add context to help moderators review this listing."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
            />
            <p className="mt-1 text-xs text-slate-500">
              {descriptionValue.length}/{DESCRIPTION_MAX_LENGTH}
            </p>
          </div>

          {isCoolingDown && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Please wait {cooldownRemaining}s before sending another report for this listing.
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              {submitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
