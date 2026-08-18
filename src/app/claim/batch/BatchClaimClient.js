'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CheckCircle,
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
import { useAuth } from '@/context/AuthContext';
import { authenticatedFetch } from '@/services/api';

const CLAIM_BENEFITS = [
  { icon: Pencil, text: 'Edit the price, photos, and details any time' },
  { icon: MessageSquare, text: 'Receive buyer and tenant enquiries directly' },
  { icon: ShieldCheck, text: 'Verified agent badge on all of your listings' }
];

function BatchClaimContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const token = searchParams.get('token') || '';
  const [status, setStatus] = useState('checking');
  const [message, setMessage] = useState('Checking your batch claim link...');
  const [payload, setPayload] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function validate() {
      if (!token) {
        setStatus('error');
        setMessage('This batch claim link is missing a token.');
        return;
      }

      try {
        const response = await fetch(`/api/claims/batch/validate?token=${encodeURIComponent(token)}`);
        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.valid) {
          if (!cancelled) {
            setStatus('error');
            setMessage(
              data.error ||
              data.message ||
              'This batch claim link is invalid, expired, or already used.'
            );
          }
          return;
        }

        if (cancelled) return;
        setPayload(data);
        setSelectedIds(
          (data.listings || [])
            .filter((item) => item.exists && !item.alreadyClaimed)
            .map((item) => item.advertId)
        );
        setStatus('ready');
        setMessage('');
      } catch (error) {
        if (!cancelled) {
          setStatus('error');
          setMessage(error.message || 'Failed to validate this batch claim link.');
        }
      }
    }

    validate();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const claimableListings = useMemo(() => (
    (payload?.listings || []).filter((item) => item.exists && !item.alreadyClaimed)
  ), [payload]);

  const toggleSelected = (advertId) => {
    setSelectedIds((current) => current.includes(advertId)
      ? current.filter((id) => id !== advertId)
      : [...current, advertId]
    );
  };

  const startClaim = () => {
    try {
      sessionStorage.setItem('pendingBatchClaimToken', token);
    } catch {}
    fetch('/api/claims/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, eventType: 'login_required' })
    }).catch(() => {});
    const redirect = `/claim/batch?token=${encodeURIComponent(token)}`;
    router.push(`/login?redirect=${encodeURIComponent(redirect)}`);
  };

  const claimSelected = async () => {
    if (!user) return;
    if (!selectedIds.length) {
      setMessage('Please select at least one property to claim.');
      return;
    }

    setClaiming(true);
    setStatus('claiming');
    setMessage('Linking selected adverts to your account...');

    try {
      const pendingToken = (() => {
        try {
          return sessionStorage.getItem('pendingBatchClaimToken') || token;
        } catch {
          return token;
        }
      })();

      const response = await authenticatedFetch('/api/claims/batch/complete', {
        method: 'POST',
        body: JSON.stringify({ token: pendingToken, advertIds: selectedIds })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to claim selected adverts');
      }

      try {
        sessionStorage.removeItem('pendingBatchClaimToken');
        sessionStorage.setItem('claimAccessGranted', 'true');
      } catch {}

      setStatus('success');
      setMessage(`${data.claimedCount || selectedIds.length} properties claimed successfully. Redirecting...`);
      router.replace(data.redirectUrl || '/dashboard?tab=my-ads&claimAccess=1');
    } catch (error) {
      setStatus('ready');
      setMessage(error.message || 'Failed to claim selected adverts.');
    } finally {
      setClaiming(false);
    }
  };

  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow">
          <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <h1 className="mb-2 text-2xl font-bold text-blue-950">Batch claim unavailable</h1>
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

  if (status === 'checking' || status === 'claiming' || status === 'success' || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow">
          {status === 'success' ? (
            <CheckCircle className="mx-auto mb-4 h-12 w-12 text-emerald-500" />
          ) : (
            <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-blue-600" />
          )}
          <h1 className="mb-2 text-2xl font-bold text-blue-950">
            {status === 'success' ? 'Adverts claimed' : 'Claim your Nijahomzs listings'}
          </h1>
          <p className="text-gray-600">{message}</p>
        </div>
      </div>
    );
  }

  const manageUrl = `/claim/batch/manage?token=${encodeURIComponent(token)}`;

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 rounded-2xl bg-white p-6 shadow">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Your adverts</p>
          <h1 className="mt-1 text-2xl font-bold text-blue-950">
            {claimableListings.length} of your {claimableListings.length === 1 ? 'property is' : 'properties are'} ready to claim
          </h1>

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

            {user ? (
              <>
                <button
                  type="button"
                  disabled={claiming || !selectedIds.length}
                  onClick={claimSelected}
                  className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-blue-600 px-5 py-3 text-base font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  <UserCheck className="mr-2 h-5 w-5" />
                  {claiming ? 'Claiming...' : `Claim ${selectedIds.length} selected listing${selectedIds.length === 1 ? '' : 's'}`}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds(claimableListings.map((item) => item.advertId))}
                  className="mt-2 w-full text-center text-sm font-semibold text-blue-700 hover:underline"
                >
                  Select all
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={startClaim}
                  className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-blue-600 px-5 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-blue-700"
                >
                  <UserCheck className="mr-2 h-5 w-5" />
                  Claim {claimableListings.length === 1 ? 'this advert' : `all ${claimableListings.length} adverts`} - free
                </button>
                <p className="mt-2 text-center text-xs text-blue-700">
                  Takes under a minute. No payment, no listing fee.
                </p>
              </>
            )}
          </div>

          {message ? <p className="mt-4 text-sm text-red-600">{message}</p> : null}
        </div>

        <div className="space-y-3">
          {claimableListings.map((item) => {
            const selectable = Boolean(user);
            const CardTag = selectable ? 'label' : 'div';

            return (
              <CardTag
                key={`${item.collectionName}-${item.advertId}`}
                className={`flex gap-3 rounded-2xl bg-white p-4 shadow ${selectable ? 'cursor-pointer hover:bg-blue-50/40' : ''}`}
              >
                {selectable ? (
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(item.advertId)}
                    onChange={() => toggleSelected(item.advertId)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                ) : null}

                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" className="h-20 w-24 flex-shrink-0 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-20 w-24 flex-shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-400">
                    <Home size={20} />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900">{item.title}</p>
                  {item.location ? (
                    <p className="mt-1 flex items-center text-sm text-gray-500">
                      <MapPin size={14} className="mr-1 text-blue-500" />
                      {item.location}
                    </p>
                  ) : null}
                  {item.price ? <p className="mt-1 text-sm font-semibold text-gray-900">{item.price}</p> : null}
                </div>
              </CardTag>
            );
          })}
        </div>

        <div className="mt-6 text-center">
          <Link
            href={manageUrl}
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-red-200 bg-white px-5 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            View or remove these adverts instead
          </Link>
          <p className="mt-3 text-xs text-gray-500">
            Viewing and removing need no account. Only claiming does.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function BatchClaimClient() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    }>
      <BatchClaimContent />
    </Suspense>
  );
}
