'use client';

import React, { useMemo } from 'react';
import { Copy, Download, QrCode, Share2 } from 'lucide-react';
import toast from 'react-hot-toast';

function resolveUrl(pathOrUrl) {
  if (!pathOrUrl) return '';
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const base = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${String(base).replace(/\/$/, '')}/${String(pathOrUrl).replace(/^\//, '')}`;
}

export default function ListingQrCode({ url, title = 'Nijahomzs listing', compact = false }) {
  const listingUrl = useMemo(() => resolveUrl(url), [url]);
  const qrUrl = useMemo(() => {
    if (!listingUrl) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=12&data=${encodeURIComponent(listingUrl)}`;
  }, [listingUrl]);

  if (!listingUrl || !qrUrl) return null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(listingUrl);
      toast.success('Listing link copied');
    } catch {
      toast.error('Could not copy link');
    }
  };

  const shareLink = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title, url: listingUrl });
      } else {
        await copyLink();
      }
    } catch (error) {
      if (error.name !== 'AbortError') toast.error('Could not share listing');
    }
  };

  return (
    <div className={`rounded-2xl border border-blue-100 bg-white shadow-sm ${compact ? 'p-3' : 'p-5'}`}>
      <div className="flex items-center gap-2 text-blue-950">
        <QrCode className="h-5 w-5 text-blue-600" />
        <h3 className="font-semibold">{compact ? 'Listing QR' : 'Share this listing'}</h3>
      </div>

      <div className={`mt-4 ${compact ? 'flex items-center gap-3' : 'text-center'}`}>
        <img
          src={qrUrl}
          alt={`QR code for ${title}`}
          className={`${compact ? 'h-24 w-24' : 'mx-auto h-44 w-44'} rounded-xl border border-gray-100 bg-white p-2`}
        />
        <div className={compact ? 'min-w-0 flex-1' : ''}>
          <p className={`${compact ? 'line-clamp-2' : 'mt-3'} text-xs text-gray-500`}>
            Scan to open the public listing page.
          </p>
          <div className={`mt-3 flex ${compact ? 'flex-wrap' : 'justify-center'} gap-2`}>
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
            >
              <Copy size={14} />
              Copy
            </button>
            <button
              type="button"
              onClick={shareLink}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              <Share2 size={14} />
              Share
            </button>
            <a
              href={qrUrl}
              download={`${title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'listing'}-qr.png`}
              className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100"
            >
              <Download size={14} />
              QR
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
