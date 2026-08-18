export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { query } from '@/lib/db/postgres-client.cjs';
import { hashToken, toDate } from '@/lib/automation/onboarding-queue-adapter.cjs';
import { rowToListing } from '@/lib/db/listing-repository.cjs';
import { logEvent } from '@/lib/db/outreach-events-repository.cjs';

const errorResponse = (message, code, status = 400) =>
  NextResponse.json({ success: false, valid: false, error: message, code }, { status });

function getListingUrl(collectionName, slug) {
  if (!slug) return '';
  if (collectionName === 'properties') return `/property/${slug}`;
  if (collectionName === 'housemates') return `/housemate/${slug}`;
  if (collectionName === 'marketplace') return `/marketplace/${slug}`;
  if (collectionName === 'services') return `/tradespeople/${slug}`;
  if (collectionName === 'noticeboard') return `/noticeboard/${slug}`;
  return '/';
}

async function resolveBatchManageToken(rawToken) {
  if (!rawToken) {
    return { error: errorResponse('This manage link is missing a token.', 'TOKEN_REQUIRED', 400) };
  }

  const result = await query(
    `SELECT *
     FROM advert_claim_batches
     WHERE token_hash = $1
     LIMIT 1`,
    [hashToken(rawToken)]
  );

  if (result.rowCount === 0) {
    return { error: errorResponse('This manage link is invalid.', 'INVALID_TOKEN', 400) };
  }

  const batch = result.rows[0];
  const expiresAt = toDate(batch.expires_at);
  if (!expiresAt || expiresAt.getTime() <= Date.now()) {
    return { error: errorResponse('This manage link has expired.', 'TOKEN_EXPIRED', 400) };
  }

  return { batch, expiresAt };
}

async function loadBatchListings(batch) {
  const advertRefs = Array.isArray(batch.advert_refs) ? batch.advert_refs : [];
  if (!advertRefs.length) return [];

  const claimedIds = new Set((batch.claimed_advert_ids || []).map(String));
  const listings = [];

  for (const ref of advertRefs) {
    if (!ref?.collectionName || !ref?.advertId) continue;

    const result = await query(
      `SELECT *
       FROM public_listings
       WHERE collection_name = $1
         AND id = $2
         AND status = 'active'
       LIMIT 1`,
      [ref.collectionName, ref.advertId]
    );

    if (result.rowCount === 0) {
      listings.push({
        advertId: ref.advertId,
        collectionName: ref.collectionName,
        title: ref.title || 'Property Listing',
        location: ref.location || '',
        exists: false,
        alreadyClaimed: claimedIds.has(String(ref.advertId))
      });
      continue;
    }

    const listing = rowToListing(result.rows[0]);
    listings.push({
      advertId: ref.advertId,
      collectionName: ref.collectionName,
      title: listing.title || ref.title || 'Property Listing',
      description: listing.description || '',
      location: listing.location || ref.location || '',
      price: listing.price || listing.priceString || '',
      listingType: listing.listingType || '',
      propertyType: listing.propertyType || listing.type || '',
      bedrooms: listing.bedrooms ?? null,
      bathrooms: listing.bathrooms ?? null,
      imageUrls: Array.isArray(listing.imageUrls) ? listing.imageUrls : [],
      publicUrl: getListingUrl(ref.collectionName, listing.slug || listing.id),
      exists: true,
      alreadyClaimed: claimedIds.has(String(ref.advertId)) || Boolean(listing.userId)
    });
  }

  return listings;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const tokenValue = searchParams.get('token') || '';
    const resolved = await resolveBatchManageToken(tokenValue);
    if (resolved.error) return resolved.error;

    const listings = await loadBatchListings(resolved.batch);
    const availableCount = listings.filter((item) => item.exists).length;

    if (!availableCount) {
      return errorResponse('These adverts are no longer available.', 'ADVERTS_NOT_FOUND', 404);
    }

    logEvent({
      batchTokenId: resolved.batch.id,
      phone: resolved.batch.phone,
      eventType: 'link_opened'
    }).catch(() => null);

    return NextResponse.json({
      success: true,
      valid: true,
      tokenId: resolved.batch.id,
      expiresAt: resolved.expiresAt,
      advertCount: listings.length,
      availableCount,
      claimableCount: listings.filter((item) => item.exists && !item.alreadyClaimed).length,
      listings
    });
  } catch (error) {
    return errorResponse(error.message || 'Failed to load adverts.', 'BATCH_MANAGE_LOAD_FAILED', 500);
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const tokenValue = searchParams.get('token') || '';
    const advertId = searchParams.get('advertId') || '';
    const resolved = await resolveBatchManageToken(tokenValue);
    if (resolved.error) return resolved.error;

    if (!advertId) {
      return errorResponse('No advert was selected for deletion.', 'ADVERT_REQUIRED', 400);
    }

    const advertRefs = Array.isArray(resolved.batch.advert_refs) ? resolved.batch.advert_refs : [];
    const ref = advertRefs.find((item) => String(item?.advertId) === String(advertId));
    if (!ref) {
      return errorResponse('This advert is not part of this link.', 'ADVERT_NOT_IN_BATCH', 400);
    }

    const deleted = await query(
      `DELETE FROM public_listings
       WHERE collection_name = $1 AND id = $2`,
      [ref.collectionName, ref.advertId]
    );

    if (deleted.rowCount === 0) {
      return errorResponse('This advert is already deleted or unavailable.', 'ADVERT_NOT_FOUND', 404);
    }

    await query(
      `UPDATE onboarding_outreach_queue
       SET status = 'deleted',
           updated_at = NOW()
       WHERE collection_name = $1 AND advert_id = $2`,
      [ref.collectionName, ref.advertId]
    ).catch(() => null);

    logEvent({
      batchTokenId: resolved.batch.id,
      advertId: ref.advertId,
      collectionName: ref.collectionName,
      phone: resolved.batch.phone,
      eventType: 'ad_deleted'
    }).catch(() => null);

    return NextResponse.json({
      success: true,
      deleted: true,
      advertId: ref.advertId,
      collectionName: ref.collectionName
    });
  } catch (error) {
    return errorResponse(error.message || 'Failed to delete advert.', 'BATCH_MANAGE_DELETE_FAILED', 500);
  }
}
