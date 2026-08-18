import { query } from '@/lib/db/postgres-client.cjs';
import { hashToken, toDate } from '@/lib/automation/onboarding-queue-adapter.cjs';
import { rowToListing } from '@/lib/db/listing-repository.cjs';

const FALLBACK_TITLE = 'Your property advert on Nijahomzs';
const FALLBACK_DESCRIPTION = 'View, update, or remove your property advert on Nijahomzs.';

function isLive(expiresAt) {
  const parsed = toDate(expiresAt);
  return Boolean(parsed && parsed.getTime() > Date.now());
}

function summarise(listing) {
  return [listing.location, listing.price || listing.priceString]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' · ');
}

async function fetchActiveListing(collectionName, advertId) {
  const result = await query(
    `SELECT *
     FROM public_listings
     WHERE collection_name = $1
       AND id = $2
       AND status = 'active'
     LIMIT 1`,
    [collectionName, advertId]
  );
  return result.rowCount ? rowToListing(result.rows[0]) : null;
}

function buildMetadata({ title, description, imageUrl }) {
  const openGraph = {
    title,
    description,
    siteName: 'Nijahomzs',
    type: 'website'
  };
  if (imageUrl) openGraph.images = [{ url: imageUrl }];

  const metadata = {
    title: `${title} - Nijahomzs`,
    description,
    robots: { index: false, follow: false },
    openGraph,
    twitter: {
      card: imageUrl ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(imageUrl ? { images: [imageUrl] } : {})
    }
  };

  return metadata;
}

export async function getSingleClaimMetadata(rawToken) {
  if (!rawToken) return buildMetadata({ title: FALLBACK_TITLE, description: FALLBACK_DESCRIPTION });

  try {
    const tokenResult = await query(
      `SELECT collection_name, advert_id, expires_at
       FROM advert_claim_tokens
       WHERE token_hash = $1
       LIMIT 1`,
      [hashToken(rawToken)]
    );

    if (!tokenResult.rowCount || !isLive(tokenResult.rows[0].expires_at)) {
      return buildMetadata({ title: FALLBACK_TITLE, description: FALLBACK_DESCRIPTION });
    }

    const token = tokenResult.rows[0];
    const listing = await fetchActiveListing(token.collection_name, token.advert_id);
    if (!listing) return buildMetadata({ title: FALLBACK_TITLE, description: FALLBACK_DESCRIPTION });

    const details = summarise(listing);
    return buildMetadata({
      title: listing.title || FALLBACK_TITLE,
      description: details
        ? `${details} - view, update, or remove this advert on Nijahomzs.`
        : FALLBACK_DESCRIPTION,
      imageUrl: Array.isArray(listing.imageUrls) ? listing.imageUrls[0] : ''
    });
  } catch {
    return buildMetadata({ title: FALLBACK_TITLE, description: FALLBACK_DESCRIPTION });
  }
}

export async function getBatchClaimMetadata(rawToken) {
  if (!rawToken) return buildMetadata({ title: FALLBACK_TITLE, description: FALLBACK_DESCRIPTION });

  try {
    const batchResult = await query(
      `SELECT advert_refs, advert_count, expires_at
       FROM advert_claim_batches
       WHERE token_hash = $1
       LIMIT 1`,
      [hashToken(rawToken)]
    );

    if (!batchResult.rowCount || !isLive(batchResult.rows[0].expires_at)) {
      return buildMetadata({ title: FALLBACK_TITLE, description: FALLBACK_DESCRIPTION });
    }

    const batch = batchResult.rows[0];
    const advertRefs = Array.isArray(batch.advert_refs) ? batch.advert_refs : [];
    const count = advertRefs.length || Number(batch.advert_count) || 0;
    const first = advertRefs[0];
    const listing = first?.collectionName && first?.advertId
      ? await fetchActiveListing(first.collectionName, first.advertId)
      : null;

    const title = count > 1
      ? `${count} of your property adverts on Nijahomzs`
      : listing?.title || FALLBACK_TITLE;

    return buildMetadata({
      title,
      description: count > 1
        ? `View, update, or remove your ${count} adverts on Nijahomzs.`
        : FALLBACK_DESCRIPTION,
      imageUrl: Array.isArray(listing?.imageUrls) ? listing.imageUrls[0] : ''
    });
  } catch {
    return buildMetadata({ title: FALLBACK_TITLE, description: FALLBACK_DESCRIPTION });
  }
}
