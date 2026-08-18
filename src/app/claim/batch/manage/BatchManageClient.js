'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ExternalLink,
  Home,
  Loader2,
  MapPin,
  MessageSquare,
  Pencil,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck
} from 'lucide-react';

const CLAIM_BENEFITS = [
  { icon: Pencil, text: 'Edit the price, photos, and details any time' },
  { icon: MessageSquare, text: 'Receive buyer and tenant enquiries directly' },
  { icon: ShieldCheck, text: 'Verified agent badge on all of your listings' }
];

function BatchManageContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Loading your adverts...');
  const [listings, setListings] = useState([]);
  const [deletingId, setDeletingId] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!token) {
      setStatus('error');
      setMessage('This manage link is missing a token.');
      return;
    }

    try {
      const response = await fetch(`/api/claims/batch/manage?token=${encodeURIComponent(token)}`, {
        cache: 'no-store'
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'These adverts are no longer available.');
      }
      setListings((data.listings || []).filter((item) => item.exists));
      setStatus('ready');
      setMessage('');
    } catch (error) {
      setStatus('error');
      setMessage(error.message || 'Unable to load your adverts.');
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (advertId, title) => {
    if (!token || deletingId) return;
    if (!confirm(`Remove "${title}" from Nijahomzs?`)) return;

    setDeletingId(advertId);
    setNotice('');
    try {
      const response = await fetch(
        `/api/claims/batch/manage?token=${encodeURIComponent(token)}&advertId=${encodeURIComponent(advertId)}`,
        { method: 'DELETE' }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to remove advert.');
      }
      setListings((current) => current.filter((item) => item.advertId !== advertId));
      setNotice(`"${title}" was removed.`);
    } catch (error) {
      setNotice(error.message || 'Failed to remove advert.');
    } finally {
      setDeletingId('');
    }
  };

  const claimableCount = useMemo(
    () => listings.filter((item) => !item.alreadyClaimed).length,
    [listings]
  );

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
        <div className="rounded-2xl bg-white p-6 text-center shadow">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-blue-600" />
          <p className="text-gray-600">{message}</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow">
          <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <h1 className="mb-2 text-2xl font-bold text-blue-950">Adverts unavailable</h1>
          <p className="mb-6 text-gray-600">{message}</p>
          <div className="flex justify-center gap-3">
            <Link href="/" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Go Home
            </Link>
            <Link href="/contact" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Contact Support
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!listings.length) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow">
          <Trash2 className="mx-auto mb-4 h-12 w-12 text-green-600" />
          <h1 className="mb-2 text-2xl font-bold text-blue-950">All adverts removed</h1>
          <p className="mb-6 text-gray-600">None of your adverts remain on Nijahomzs.</p>
          <Link href="/" className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  const claimUrl = `/claim/batch?token=${encodeURIComponent(token)}`;

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 rounded-2xl bg-white p-6 shadow">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Your adverts</p>
          <h1 className="mt-1 text-2xl font-bold text-blue-950">
            {listings.length} of your {listings.length === 1 ? 'property is' : 'properties are'} live on Nijahomzs
          </h1>
          <p className="mt-2 text-gray-600">
            Review each one below. You can view or remove any of them without an account.
          </p>

          {claimableCount > 0 ? (
            <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
              <p className="font-semibold text-blue-950">Claim them free to take full control</p>
              <ul className="mt-3 space-y-2">
                {CLAIM_BENEFITS.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-start text-sm text-blue-900">
                    <Icon className="mr-2 mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={claimUrl}
                className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-blue-600 px-5 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                <UserCheck className="mr-2 h-5 w-5" />
                Claim {claimableCount === 1 ? 'this advert' : `all ${claimableCount} adverts`} - free
              </Link>
              <p className="mt-2 text-center text-xs text-blue-700">
                Takes under a minute. No payment, no listing fee.
              </p>
            </div>
          ) : null}

          {notice ? <p className="mt-4 text-sm text-blue-700">{notice}</p> : null}
        </div>

        <div className="space-y-4">
          {listings.map((item) => (
            <div key={`${item.collectionName}-${item.advertId}`} className="overflow-hidden rounded-2xl bg-white shadow">
              <div className="flex flex-col gap-4 p-4 sm:flex-row">
                {item.imageUrls?.[0] ? (
                  <img
                    src={item.imageUrls[0]}
                    alt={item.title}
                    className="h-40 w-full flex-shrink-0 rounded-xl object-cover sm:h-28 sm:w-40"
                  />
                ) : (
                  <div className="flex h-40 w-full flex-shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-400 sm:h-28 sm:w-40">
                    <Home size={24} />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold text-blue-950">{item.title}</h2>
                  {item.location ? (
                    <p className="mt-1 flex items-center text-sm text-gray-500">
                      <MapPin size={14} className="mr-1 text-blue-500" />
                      {item.location}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                    {item.price ? <span className="font-semibold text-gray-900">{item.price}</span> : null}
                    {item.propertyType || item.listingType ? (
                      <span>{[item.propertyType, item.listingType].filter(Boolean).join(' / ')}</span>
                    ) : null}
                    {item.imageUrls?.length > 1 ? <span>{item.imageUrls.length} photos</span> : null}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.publicUrl ? (
                      <Link
                        href={item.publicUrl}
                        className="inline-flex min-h-10 items-center justify-center rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        View
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleDelete(item.advertId, item.title)}
                      disabled={deletingId === item.advertId}
                      className="inline-flex min-h-10 items-center justify-center rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingId === item.advertId ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="mr-2 h-4 w-4" />
                      )}
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-gray-500">
          Viewing and removing need no account. Only claiming does.
        </p>
      </div>
    </div>
  );
}

export default function BatchManageClient() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    }>
      <BatchManageContent />
    </Suspense>
  );
}
