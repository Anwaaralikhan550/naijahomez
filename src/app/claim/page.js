'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authenticatedFetch } from '@/services/api';

function ClaimContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState('checking');
  const [message, setMessage] = useState('Checking your claim link...');
  const token = searchParams.get('token') || '';

  useEffect(() => {
    let cancelled = false;

    async function validateAndClaim() {
      if (!token) {
        setStatus('error');
        setMessage('This claim link is missing a token.');
        return;
      }

      try {
        const validateResponse = await fetch(`/api/claims/validate?token=${encodeURIComponent(token)}`);
        const validatePayload = await validateResponse.json().catch(() => ({}));

        if (!validateResponse.ok || !validatePayload.valid) {
          if (!cancelled) {
            setStatus('error');
            setMessage(
              validatePayload.error ||
              validatePayload.message ||
              'This claim link is invalid, expired, or already used.'
            );
          }
          return;
        }

        if (authLoading) return;

        if (!user) {
          try {
            sessionStorage.setItem('pendingClaimToken', token);
          } catch {}
          const redirect = `/claim?token=${encodeURIComponent(token)}`;
          router.replace(`/login?redirect=${encodeURIComponent(redirect)}`);
          return;
        }

        setStatus('claiming');
        setMessage('Linking this advert to your account...');

        const pendingToken = (() => {
          try {
            return sessionStorage.getItem('pendingClaimToken') || token;
          } catch {
            return token;
          }
        })();

        const claimResponse = await authenticatedFetch('/api/claims/complete', {
          method: 'POST',
          body: JSON.stringify({ token: pendingToken })
        });
        const claimPayload = await claimResponse.json().catch(() => ({}));

        if (!claimResponse.ok || !claimPayload.success) {
          throw new Error(claimPayload.error || 'Failed to claim advert');
        }

        try {
          sessionStorage.removeItem('pendingClaimToken');
          sessionStorage.setItem('claimAccessGranted', 'true');
        } catch {}

        setStatus('success');
        setMessage('Advert claimed successfully. Redirecting...');
        router.replace(claimPayload.redirectUrl || '/dashboard?tab=my-ads&claimAccess=1');
      } catch (error) {
        if (!cancelled) {
          setStatus('error');
          setMessage(error.message || 'Failed to claim this advert.');
        }
      }
    }

    validateAndClaim();

    return () => {
      cancelled = true;
    };
  }, [authLoading, router, token, user]);

  const isError = status === 'error';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-lg bg-white p-6 text-center shadow">
        {isError ? (
          <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-red-500" />
        ) : status === 'success' ? (
          <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
        ) : (
          <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-blue-600" />
        )}

        <h1 className="mb-2 text-2xl font-bold text-blue-950">
          {isError ? 'Claim link unavailable' : 'Claiming advert'}
        </h1>
        <p className="mb-6 text-gray-600">{message}</p>

        {isError && (
          <div className="flex justify-center gap-3">
            <Link
              href="/"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Go Home
            </Link>
            <Link
              href="/contact"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Contact Support
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ClaimPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    }>
      <ClaimContent />
    </Suspense>
  );
}
