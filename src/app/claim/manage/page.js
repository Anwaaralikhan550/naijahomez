'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ExternalLink, Loader2, MapPin, ShieldAlert, Trash2, UserCheck } from 'lucide-react';

function ManageAdvertContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Loading your advert...');
  const [payload, setPayload] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadAdvert() {
      if (!token) {
        setStatus('error');
        setMessage('This manage link is missing a token.');
        return;
      }

      try {
        const response = await fetch(`/api/claims/manage?token=${encodeURIComponent(token)}`, {
          cache: 'no-store'
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'This advert is no longer available.');
        }
        if (!cancelled) {
          setPayload(data);
          setStatus('ready');
          setMessage('');
        }
      } catch (error) {
        if (!cancelled) {
          setStatus('error');
          setMessage(error.message || 'Unable to load this advert.');
        }
      }
    }

    loadAdvert();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleDelete = async () => {
    if (!token || deleting) return;
    if (!confirm('Delete this advert from Nijahomzs?')) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/claims/manage?token=${encodeURIComponent(token)}`, {
        method: 'DELETE'
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete advert.');
      }
      setStatus('deleted');
      setMessage('Advert deleted successfully.');
      setPayload(null);
    } catch (error) {
      setStatus('ready');
      setMessage(error.message || 'Failed to delete advert.');
    } finally {
      setDeleting(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
        <div className="rounded-lg bg-white p-6 text-center shadow">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-blue-600" />
          <p className="text-gray-600">{message}</p>
        </div>
      </div>
    );
  }

  if (status === 'error' || status === 'deleted') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-lg bg-white p-6 text-center shadow">
          {status === 'error' ? (
            <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-red-500" />
          ) : (
            <Trash2 className="mx-auto mb-4 h-12 w-12 text-green-600" />
          )}
          <h1 className="mb-2 text-2xl font-bold text-blue-950">
            {status === 'error' ? 'Advert unavailable' : 'Advert deleted'}
          </h1>
          <p className="mb-6 text-gray-600">{message}</p>
          <Link
            href="/"
            className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  const listing = payload?.listing || {};
  const imageUrl = Array.isArray(listing.imageUrls) ? listing.imageUrls[0] : '';
  const claimUrl = token ? `/claim?token=${encodeURIComponent(token)}` : '/claim';
  const actionGridClass = listing.publicUrl ? 'grid gap-3 sm:grid-cols-3' : 'grid gap-3 sm:grid-cols-2';

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-3xl overflow-hidden rounded-lg bg-white shadow">
        {imageUrl ? (
          <img src={imageUrl} alt={listing.title || 'Advert'} className="h-64 w-full object-cover" />
        ) : (
          <div className="flex h-48 items-center justify-center bg-blue-50 text-blue-900">
            Nijahomzs advert
          </div>
        )}

        <div className="p-6">
          <div className="mb-4">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-blue-600">Your advert</p>
            <h1 className="text-2xl font-bold text-blue-950">{listing.title || 'Property Listing'}</h1>
            {listing.location ? (
              <div className="mt-2 flex items-center text-gray-600">
                <MapPin className="mr-2 h-4 w-4" />
                <span>{listing.location}</span>
              </div>
            ) : null}
          </div>

          <div className="mb-5 grid gap-3 sm:grid-cols-2">
            {listing.price ? (
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs font-medium uppercase text-gray-500">Price</p>
                <p className="font-semibold text-gray-900">{listing.price}</p>
              </div>
            ) : null}
            {listing.propertyType || listing.listingType ? (
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs font-medium uppercase text-gray-500">Type</p>
                <p className="font-semibold text-gray-900">
                  {[listing.propertyType, listing.listingType].filter(Boolean).join(' / ')}
                </p>
              </div>
            ) : null}
          </div>

          {listing.description ? (
            <p className="mb-6 whitespace-pre-line text-gray-700">{listing.description}</p>
          ) : null}

          {message ? <p className="mb-4 text-sm text-red-600">{message}</p> : null}

          <div className={actionGridClass}>
            {listing.publicUrl ? (
              <Link
                href={listing.publicUrl}
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View Ad
              </Link>
            ) : null}
            <Link
              href={claimUrl}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-slate-200 transition hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-md"
            >
              <UserCheck className="mr-2 h-4 w-4" />
              Claim Ad
            </Link>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-red-200 bg-white px-5 py-3 text-sm font-semibold text-red-600 shadow-sm shadow-red-100 transition hover:-translate-y-0.5 hover:bg-red-50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete Ad
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ManageAdvertPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    }>
      <ManageAdvertContent />
    </Suspense>
  );
}
