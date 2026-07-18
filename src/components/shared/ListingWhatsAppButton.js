'use client';

import React from 'react';
import { MessageCircle } from 'lucide-react';
import { trackClick, trackJourneyStep } from '@/lib/analytics/events';

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

export default function ListingWhatsAppButton({
  phone,
  title,
  listingId,
  listingType = 'properties',
  className = ''
}) {
  const phoneDigits = normalizePhone(phone);
  if (!phoneDigits) return null;

  const text = encodeURIComponent(`Hello, I'm interested in your listing on Nijahomzs: ${title || 'Listing'}`);
  const href = `https://wa.me/${phoneDigits}?text=${text}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        trackJourneyStep('whatsapp_click', {
          source: 'listing_card',
          listingType
        });
        if (listingId) trackClick(listingId, listingType);
      }}
      className={`inline-flex items-center gap-2 rounded-lg bg-green-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-600 ${className}`}
    >
      <MessageCircle size={16} />
      WhatsApp
    </a>
  );
}
