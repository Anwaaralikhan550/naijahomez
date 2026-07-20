'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, Home, Loader2, MapPin, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authenticatedFetch } from '@/services/api';

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
        setMessage(`${data.claimableCount || 0} properties are ready to claim.`);
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

  useEffect(() => {
    if (authLoading || user || status !== 'ready') return;
    try {
      sessionStorage.setItem('pendingBatchClaimToken', token);
    } catch {}
    fetch('/api/claims/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, eventType: 'login_required' })
    }).catch(() => {});
    const redirect = `/claim/batch?token=${encodeURIComponent(token)}`;
    router.replace(`/login?redirect=${encodeURIComponent(redirect)}`);
  }, [authLoading, router, status, token, user]);

  const claimableListings = useMemo(() => (
    (payload?.listings || []).filter((item) => item.exists && !item.alreadyClaimed)
  ), [payload]);

  const toggleSelected = (advertId) => {
    setSelectedIds((current) => current.includes(advertId)
      ? current.filter((id) => id !== advertId)
      : [...current, advertId]
    );
  };

  const claimSelected = async () => {
    if (!user) return;
    if (!selectedIds.length) {
      setStatus('error');
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
      setStatus('error');
      setMessage(error.message || 'Failed to claim selected adverts.');
    } finally {
      setClaiming(false);
    }
  };

  const isLoading = status === 'checking' || authLoading || status === 'claiming';
  const isError = status === 'error';

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-md">
        <div className="mb-6 text-center">
          {isError ? (
            <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-red-500" />
          ) : status === 'success' ? (
            <CheckCircle className="mx-auto mb-4 h-12 w-12 text-emerald-500" />
          ) : isLoading ? (
            <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-blue-600" />
          ) : (
            <Home className="mx-auto mb-4 h-12 w-12 text-blue-600" />
          )}

          <h1 className="text-2xl font-bold text-blue-950">
            {isError ? 'Batch claim unavailable' : 'Claim your Nijahomzs listings'}
          </h1>
          <p className="mt-2 text-gray-600">{message}</p>
        </div>

        {status === 'ready' && user && (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-blue-50 p-4">
              <div>
                <p className="font-semibold text-blue-950">{claimableListings.length} claimable listings</p>
                <p className="text-sm text-blue-700">Select the adverts you want to attach to your account.</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedIds(claimableListings.map((item) => item.advertId))}
                className="rounded-xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-white"
              >
                Select all
              </button>
            </div>

            <div className="mb-6 max-h-[420px] space-y-3 overflow-auto pr-1">
              {claimableListings.map((item) => (
                <label
                  key={`${item.collectionName}-${item.advertId}`}
                  className="flex cursor-pointer gap-3 rounded-2xl border border-gray-200 p-4 hover:border-blue-300 hover:bg-blue-50/40"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(item.advertId)}
                    onChange={() => toggleSelected(item.advertId)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" className="h-16 w-20 rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-16 w-20 items-center justify-center rounded-xl bg-gray-100 text-gray-400">
                      <Home size={20} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900">{item.title}</p>
                    {item.location && (
                      <p className="mt-1 flex items-center text-sm text-gray-500">
                        <MapPin size={14} className="mr-1 text-blue-500" />
                        {item.location}
                      </p>
                    )}
                  </div>
                </label>
              ))}
            </div>

            <button
              type="button"
              disabled={claiming || !selectedIds.length}
              onClick={claimSelected}
              className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {claiming ? 'Claiming...' : `Claim ${selectedIds.length} selected listing${selectedIds.length === 1 ? '' : 's'}`}
            </button>
          </>
        )}

        {isError && (
          <div className="flex justify-center gap-3">
            <Link href="/" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Go Home
            </Link>
            <Link href="/contact" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Contact Support
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BatchClaimPage() {
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
