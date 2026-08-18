'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  BedDouble,
  CheckCircle,
  Images,
  Loader2,
  MapPin,
  MessageSquare,
  Pencil,
  ShieldAlert,
  ShieldCheck,
  Trash2
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authenticatedFetch } from '@/services/api';

function listingPublicUrl(listing) {
  const slug = listing?.slug || listing?.id;
  if (!slug) return '';
  const collection = listing?.collectionName || 'properties';
  if (collection === 'properties') return `/property/${slug}`;
  if (collection === 'housemates') return `/housemate/${slug}`;
  if (collection === 'marketplace') return `/marketplace/${slug}`;
  if (collection === 'services') return `/tradespeople/${slug}`;
  if (collection === 'noticeboard') return `/noticeboard/${slug}`;
  return '';
}

const CLAIM_BENEFITS = [
  { icon: Pencil, text: 'Edit the price, photos, and details any time' },
  { icon: MessageSquare, text: 'Receive buyer and tenant enquiries directly' },
  { icon: ShieldCheck, text: 'Verified agent badge on all of your listings' }
];

function ClaimContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState('checking');
  const [message, setMessage] = useState('Checking your claim link...');
  const [listing, setListing] = useState(null);
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

        if (cancelled) return;
        setListing(validatePayload.listing || null);

        if (authLoading) return;

        // Logged-out visitors see the advert first and choose what to do next.
        if (!user) {
          setStatus('preview');
          setMessage('');
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

  const startClaim = () => {
    try {
      sessionStorage.setItem('pendingClaimToken', token);
    } catch {}
    fetch('/api/claims/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, eventType: 'login_required' })
    }).catch(() => {});
    const redirect = `/claim?token=${encodeURIComponent(token)}`;
    router.push(`/login?redirect=${encodeURIComponent(redirect)}`);
  };

  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow">
          <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <h1 className="mb-2 text-2xl font-bold text-blue-950">Claim link unavailable</h1>
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

  if (status !== 'preview') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow">
          {status === 'success' ? (
            <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
          ) : (
            <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-blue-600" />
          )}
          <h1 className="mb-2 text-2xl font-bold text-blue-950">
            {status === 'success' ? 'Advert claimed' : 'Claiming advert'}
          </h1>
          <p className="text-gray-600">{message}</p>
        </div>
      </div>
    );
  }

  const images = Array.isArray(listing?.imageUrls) ? listing.imageUrls : [];
  const publicUrl = listingPublicUrl(listing);
  const manageUrl = `/claim/manage?token=${encodeURIComponent(token)}`;

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl bg-white shadow">
        {images[0] ? (
          <div className="relative">
            <img src={images[0]} alt={listing?.title || 'Your advert'} className="h-72 w-full object-cover" />
            {images.length > 1 ? (
              <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">
                <Images className="h-3.5 w-3.5" />
                {images.length} photos
              </span>
            ) : null}
          </div>
        ) : (
          <div className="flex h-48 items-center justify-center bg-blue-50 text-blue-900">Nijahomzs advert</div>
        )}

        {images.length > 1 ? (
          <div className="flex gap-2 overflow-x-auto border-b border-gray-100 px-5 py-3">
            {images.slice(1, 7).map((url) => (
              <img key={url} src={url} alt="" className="h-16 w-20 flex-shrink-0 rounded-lg object-cover" />
            ))}
          </div>
        ) : null}

        <div className="p-6">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-blue-600">This is your advert</p>
          <h1 className="text-2xl font-bold text-blue-950">{listing?.title || 'Property Listing'}</h1>

          {listing?.location ? (
            <div className="mt-2 flex items-center text-gray-600">
              <MapPin className="mr-2 h-4 w-4" />
              <span>{listing.location}</span>
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {listing?.price ? (
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs font-medium uppercase text-gray-500">Price</p>
                <p className="font-semibold text-gray-900">{listing.price}</p>
              </div>
            ) : null}
            {listing?.propertyType || listing?.listingType ? (
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs font-medium uppercase text-gray-500">Type</p>
                <p className="font-semibold text-gray-900">
                  {[listing.propertyType, listing.listingType].filter(Boolean).join(' / ')}
                </p>
              </div>
            ) : null}
            {listing?.bedrooms ? (
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs font-medium uppercase text-gray-500">Bedrooms</p>
                <p className="flex items-center font-semibold text-gray-900">
                  <BedDouble className="mr-2 h-4 w-4 text-blue-600" />
                  {listing.bedrooms}
                </p>
              </div>
            ) : null}
          </div>

          <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
            <p className="font-semibold text-blue-950">Claim it free to take full control</p>
            <ul className="mt-3 space-y-2">
              {CLAIM_BENEFITS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start text-sm text-blue-900">
                  <Icon className="mr-2 mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={startClaim}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-blue-600 px-5 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              Claim this advert - free
            </button>
            <p className="mt-2 text-center text-xs text-blue-700">
              Takes under a minute. No payment, no listing fee.
            </p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {publicUrl ? (
              <Link
                href={publicUrl}
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                View it live
              </Link>
            ) : null}
            <Link
              href={manageUrl}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-red-200 px-5 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remove this advert
            </Link>
          </div>
          <p className="mt-3 text-center text-xs text-gray-500">
            Viewing and removing need no account. Only claiming does.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ClaimClient() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    }>
      <ClaimContent />
    </Suspense>
  );
}
