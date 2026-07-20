export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { query } from '@/lib/db/postgres-client.cjs';
import { hashToken, toDate } from '@/lib/automation/onboarding-queue-adapter.cjs';
import { rowToListing } from '@/lib/db/listing-repository.cjs';
import { logEvent } from '@/lib/db/outreach-events-repository.cjs';

const errorResponse = (message, code, status = 400) =>
  NextResponse.json({ success: false, valid: false, error: message, code }, { status });

function getListingUrl(listing) {
  const slug = listing?.slug || listing?.id;
  if (!slug) return '';
  const collection = listing.collectionName || listing.collection_name || 'properties';
  if (collection === 'properties') return `/property/${slug}`;
  if (collection === 'housemates') return `/housemate/${slug}`;
  if (collection === 'marketplace') return `/marketplace/${slug}`;
  if (collection === 'services') return `/tradespeople/${slug}`;
  if (collection === 'noticeboard') return `/noticeboard/${slug}`;
  return '/';
}

async function resolveManageToken(rawToken) {
  if (!rawToken) {
    return { error: errorResponse('This manage link is missing a token.', 'TOKEN_REQUIRED', 400) };
  }

  const tokenResult = await query(
    `SELECT *
     FROM advert_claim_tokens
     WHERE token_hash = $1
     LIMIT 1`,
    [hashToken(rawToken)]
  );

  if (tokenResult.rowCount === 0) {
    return { error: errorResponse('This manage link is invalid.', 'INVALID_TOKEN', 400) };
  }

  const token = tokenResult.rows[0];
  const expiresAt = toDate(token.expires_at);
  if (!expiresAt || expiresAt.getTime() <= Date.now()) {
    return { error: errorResponse('This manage link has expired.', 'TOKEN_EXPIRED', 400) };
  }

  return { token, expiresAt };
}

async function fetchManagedListing(token) {
  const listingResult = await query(
    `SELECT *
     FROM public_listings
     WHERE collection_name = $1
       AND id = $2
       AND status = 'active'
     LIMIT 1`,
    [token.collection_name, token.advert_id]
  );

  if (listingResult.rowCount === 0) return null;
  const row = listingResult.rows[0];
  return {
    ...rowToListing(row),
    collectionName: row.collection_name
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const tokenValue = searchParams.get('token') || '';
    const resolved = await resolveManageToken(tokenValue);
    if (resolved.error) return resolved.error;

    const listing = await fetchManagedListing(resolved.token);
    if (!listing) {
      return errorResponse('This advert is no longer available.', 'ADVERT_NOT_FOUND', 404);
    }

    logEvent({
      claimTokenId: resolved.token.id,
      advertId: resolved.token.advert_id,
      collectionName: resolved.token.collection_name,
      eventType: 'link_opened'
    }).catch(() => null);

    return NextResponse.json({
      success: true,
      valid: true,
      tokenId: resolved.token.id,
      expiresAt: resolved.expiresAt,
      listing: {
        id: listing.id,
        collectionName: listing.collectionName,
        title: listing.title || 'Property Listing',
        description: listing.description || '',
        location: listing.location || '',
        price: listing.price || listing.priceString || '',
        listingType: listing.listingType || '',
        propertyType: listing.propertyType || listing.type || '',
        bedrooms: listing.bedrooms || null,
        bathrooms: listing.bathrooms || null,
        imageUrls: Array.isArray(listing.imageUrls) ? listing.imageUrls : [],
        publicUrl: getListingUrl(listing)
      }
    });
  } catch (error) {
    return errorResponse(error.message || 'Failed to load advert.', 'MANAGE_LOAD_FAILED', 500);
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const tokenValue = searchParams.get('token') || '';
    const resolved = await resolveManageToken(tokenValue);
    if (resolved.error) return resolved.error;

    const listing = await fetchManagedListing(resolved.token);
    if (!listing) {
      return errorResponse('This advert is already deleted or unavailable.', 'ADVERT_NOT_FOUND', 404);
    }

    await query(
      `DELETE FROM public_listings
       WHERE collection_name = $1 AND id = $2`,
      [resolved.token.collection_name, resolved.token.advert_id]
    );

    await query(
      `UPDATE advert_claim_tokens
       SET claimed_at = COALESCE(claimed_at, NOW()),
           claimed_by_user_id = COALESCE(claimed_by_user_id, 'token_delete'),
           updated_at = NOW()
       WHERE id = $1`,
      [resolved.token.id]
    ).catch(() => null);

    await query(
      `UPDATE onboarding_outreach_queue
       SET status = 'deleted',
           updated_at = NOW()
       WHERE collection_name = $1 AND advert_id = $2`,
      [resolved.token.collection_name, resolved.token.advert_id]
    ).catch(() => null);

    logEvent({
      claimTokenId: resolved.token.id,
      advertId: resolved.token.advert_id,
      collectionName: resolved.token.collection_name,
      eventType: 'ad_deleted'
    }).catch(() => null);

    return NextResponse.json({
      success: true,
      deleted: true,
      advertId: resolved.token.advert_id,
      collectionName: resolved.token.collection_name
    });
  } catch (error) {
    return errorResponse(error.message || 'Failed to delete advert.', 'MANAGE_DELETE_FAILED', 500);
  }
}
