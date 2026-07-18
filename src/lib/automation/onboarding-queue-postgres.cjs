const crypto = require('crypto');
const { getPool, isAppDbEnabled, query } = require('../db/postgres-client.cjs');
const { rowToListing } = require('../db/listing-repository.cjs');

const CLAIM_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const STALE_PROCESSING_MS = 10 * 60 * 1000;
const PRIORITY_LOCATIONS = ['lagos', 'abuja', 'port harcourt'];
const MAX_BATCH_ADVERTS = 20;

function nowDate() {
  return new Date();
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
}

function createRawToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function randomDelayMs(minSeconds = 30, maxSeconds = 60) {
  const min = Math.max(0, Number(minSeconds) || 30);
  const max = Math.max(min, Number(maxSeconds) || 60);
  return Math.floor((min + Math.random() * (max - min)) * 1000);
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeLocationText(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveListingLocation(listing = {}) {
  const location =
    listing.location ||
    listing.city ||
    listing.state ||
    listing.area ||
    listing.address ||
    listing.contact?.location;

  if (typeof location === 'string') return location;
  if (location && typeof location === 'object') {
    return [location.area, location.city, location.state, location.country]
      .filter(Boolean)
      .join(', ');
  }

  return '';
}

function getLocationPriority(location) {
  const normalized = normalizeLocationText(location);
  if (!normalized) return 10;
  return PRIORITY_LOCATIONS.some((target) => normalized.includes(target)) ? 0 : 10;
}

function normalizePhoneNumber(rawValue) {
  if (!rawValue) return null;
  const digits = String(rawValue).replace(/\D/g, '');
  if (!digits) return null;

  if (digits.startsWith('2340')) {
    const withoutTrunkZero = `234${digits.slice(4)}`;
    return /^234[789]\d{9}$/.test(withoutTrunkZero) ? withoutTrunkZero : null;
  }
  if (/^234[789]\d{9}$/.test(digits)) return digits;
  if (digits.startsWith('0') && digits.length === 11) return `234${digits.slice(1)}`;
  if (digits.length === 10 && /^[789]/.test(digits)) return `234${digits}`;
  if (digits.length > 10 && !digits.startsWith('234')) return `234${digits.slice(-10)}`;
  return null;
}

function extractPhoneFromText(text) {
  if (!text) return null;
  const matches = String(text).match(/(\+?\d[\d\s\-().]{8,}\d)/g);
  if (!matches) return null;

  for (const match of matches) {
    const normalized = normalizePhoneNumber(match);
    if (normalized) return normalized;
  }

  return null;
}

function resolveAgentPhone(listing = {}) {
  const direct =
    listing.whatsappNumber ||
    listing.phoneNumber ||
    listing.contactPhone ||
    listing.phone ||
    listing.contact?.whatsapp ||
    listing.contact?.phone;

  return (
    normalizePhoneNumber(direct) ||
    extractPhoneFromText(listing.originalDescription) ||
    extractPhoneFromText(listing.description)
  );
}

function resolveAgentName(listing = {}) {
  return (
    listing.agentName ||
    listing.userName ||
    listing.ownerName ||
    listing.contact?.name ||
    listing.agent?.name ||
    'Agent'
  );
}

function isUnclaimedImportedListing(listing = {}) {
  const userId = String(listing.userId || listing.user_id || listing.agent?.id || '').trim().toLowerCase();
  const hasRealUser = userId && !['unknown', 'system', 'system-scraped-listings'].includes(userId);
  if (hasRealUser) return false;

  return listing.isScraped === true || listing.dataSource === 'scraped' || Boolean(listing.sourceUrl);
}

function buildQueueDocId(collectionName, advertId, phone) {
  const hash = crypto
    .createHash('sha1')
    .update(`${collectionName}:${advertId}:${phone}`)
    .digest('hex')
    .slice(0, 16);
  return `${collectionName}_${advertId}_${hash}`.replace(/[^A-Za-z0-9_-]/g, '_');
}

function buildSuppressedNumberId(phone) {
  return normalizePhoneNumber(phone) || String(phone || '').replace(/\D/g, '');
}

function uniqueAdvertRefs(items = []) {
  const seen = new Set();
  const refs = [];

  items.forEach((item) => {
    const collectionName = item.collectionName || item.collection_name || item.listing?.collectionName || 'properties';
    const advertId = item.advertId || item.advert_id || item.id || item.listing?.id;
    if (!collectionName || !advertId) return;

    const key = `${collectionName}:${advertId}`;
    if (seen.has(key)) return;
    seen.add(key);
    refs.push({
      collectionName,
      advertId,
      title: item.title || item.listing?.title || '',
      location: item.location || item.listing?.location || ''
    });
  });

  return refs.slice(0, MAX_BATCH_ADVERTS);
}

function queueRowToItem(row = {}) {
  return {
    id: row.id,
    advertId: row.advert_id,
    collectionName: row.collection_name,
    phone: row.phone,
    agentName: row.agent_name,
    location: row.location,
    priority: row.priority,
    status: row.status,
    claimTokenId: row.claim_token_id,
    batchTokenId: row.batch_token_id,
    attempts: row.attempts,
    lastError: row.last_error,
    lockedAt: row.locked_at,
    nextRunAt: row.next_run_at,
    sentAt: row.sent_at,
    providerMessageId: row.provider_message_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.data && typeof row.data === 'object' ? row.data : {})
  };
}

function batchRowToData(row = {}) {
  return {
    id: row.id,
    phone: row.phone,
    rawPhone: row.raw_phone,
    advertRefs: Array.isArray(row.advert_refs) ? row.advert_refs : [],
    advertCount: row.advert_count,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    sentAt: row.sent_at,
    claimedAt: row.claimed_at,
    claimedByUserId: row.claimed_by_user_id,
    claimedAdvertIds: Array.isArray(row.claimed_advert_ids) ? row.claimed_advert_ids : [],
    providerMessageId: row.provider_message_id
  };
}

async function fetchListing(_db, collectionName, advertId) {
  if (!isAppDbEnabled()) return null;
  const result = await query(
    `SELECT *
     FROM public_listings
     WHERE collection_name = $1 AND id = $2 AND status = 'active'
     LIMIT 1`,
    [collectionName, advertId]
  );
  return result.rows[0] ? rowToListing(result.rows[0]) : null;
}

async function createClaimToken({ collectionName, advertId }) {
  const rawToken = createRawToken();
  const now = nowDate();
  const expiresAt = new Date(now.getTime() + CLAIM_TOKEN_TTL_MS);
  const result = await query(
    `INSERT INTO advert_claim_tokens (
      advert_id, collection_name, token_hash, expires_at, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $5)
    RETURNING id`,
    [advertId, collectionName, hashToken(rawToken), expiresAt, now]
  );

  return {
    id: result.rows[0].id,
    rawToken,
    claimUrl: `${getAppUrl()}/claim?token=${encodeURIComponent(rawToken)}`,
    manageUrl: `${getAppUrl()}/claim/manage?token=${encodeURIComponent(rawToken)}`,
    expiresAt
  };
}

async function createBatchClaimToken({ phone, queueItems = [], listings = [] }) {
  const rawToken = createRawToken();
  const now = nowDate();
  const expiresAt = new Date(now.getTime() + CLAIM_TOKEN_TTL_MS);
  const listingById = new Map(listings.map((listing) => [String(listing.id), listing]));
  const advertRefs = uniqueAdvertRefs(queueItems.map((item) => {
    const listing = listingById.get(String(item.advertId)) || {};
    return {
      ...item,
      title: listing.title || item.title,
      location: resolveListingLocation(listing) || item.location
    };
  }));

  const normalizedPhone = buildSuppressedNumberId(phone);
  const result = await query(
    `INSERT INTO advert_claim_batches (
      phone, raw_phone, advert_refs, advert_count, token_hash, expires_at, created_at, updated_at
    ) VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $7)
    RETURNING id`,
    [
      normalizedPhone,
      phone || null,
      JSON.stringify(advertRefs),
      advertRefs.length,
      hashToken(rawToken),
      expiresAt,
      now
    ]
  );

  return {
    id: result.rows[0].id,
    rawToken,
    claimUrl: `${getAppUrl()}/claim/batch?token=${encodeURIComponent(rawToken)}`,
    expiresAt,
    advertRefs
  };
}

async function createOnboardingQueueItem({
  collectionName,
  advertId,
  listing = null,
  force = false
}) {
  if (collectionName !== 'properties' || !advertId) {
    return { queued: false, reason: 'unsupported_collection' };
  }

  const resolvedListing = listing || await fetchListing(null, collectionName, advertId);
  if (!resolvedListing) return { queued: false, reason: 'listing_not_found' };
  if (!force && !isUnclaimedImportedListing(resolvedListing)) {
    return { queued: false, reason: 'not_imported_or_already_owned' };
  }

  const phone = resolveAgentPhone(resolvedListing);
  if (!phone) return { queued: false, reason: 'missing_valid_phone' };

  const docId = buildQueueDocId(collectionName, advertId, phone);
  const now = nowDate();
  const location = resolveListingLocation(resolvedListing);
  const result = await query(
    `INSERT INTO onboarding_outreach_queue (
      id, advert_id, collection_name, phone, agent_name, location, priority,
      status, attempts, next_run_at, created_at, updated_at, data
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      'pending', 0, $8, $9, $9, $10::jsonb
    )
    ON CONFLICT (id) DO NOTHING
    RETURNING id`,
    [
      docId,
      advertId,
      collectionName,
      phone,
      resolveAgentName(resolvedListing),
      location,
      getLocationPriority(location),
      new Date(now.getTime() + randomDelayMs(30, 60)),
      now,
      JSON.stringify({
        title: resolvedListing.title || '',
        source: 'postgres'
      })
    ]
  );

  if (result.rowCount === 0) {
    return { queued: false, reason: 'already_queued', queueId: docId };
  }

  return { queued: true, queueId: docId, phone };
}

async function isNumberSuppressed({ phone }) {
  const suppressedId = buildSuppressedNumberId(phone);
  if (!suppressedId) return false;
  const result = await query('SELECT phone FROM suppressed_numbers WHERE phone = $1 LIMIT 1', [suppressedId]);
  return result.rowCount > 0;
}

async function suppressNumber({
  phone,
  source = 'evolution_webhook',
  reason = 'STOP',
  rawPayload = null
}) {
  const suppressedId = buildSuppressedNumberId(phone);
  if (!suppressedId) {
    return { suppressed: false, reason: 'missing_valid_phone' };
  }

  const now = nowDate();
  await query(
    `INSERT INTO suppressed_numbers (
      phone, raw_phone, source, reason, raw_payload, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $6)
    ON CONFLICT (phone) DO UPDATE SET
      raw_phone = EXCLUDED.raw_phone,
      source = EXCLUDED.source,
      reason = EXCLUDED.reason,
      raw_payload = EXCLUDED.raw_payload,
      updated_at = EXCLUDED.updated_at`,
    [
      suppressedId,
      phone || null,
      source,
      reason,
      rawPayload ? JSON.stringify(rawPayload).slice(0, 5000) : null,
      now
    ]
  );

  return { suppressed: true, phone: suppressedId };
}

async function markQueueSuppressed(queueRefOrId, phone) {
  const id = typeof queueRefOrId === 'string' ? queueRefOrId : queueRefOrId?.id;
  if (!id) return;
  const now = nowDate();
  await query(
    `UPDATE onboarding_outreach_queue
     SET status = 'suppressed',
         suppressed_at = $2,
         suppressed_phone = $3,
         locked_at = NULL,
         last_error = 'Phone number opted out',
         updated_at = $2
     WHERE id = $1`,
    [id, now, buildSuppressedNumberId(phone)]
  );
}

async function countSentMessagesSince({ since }) {
  const result = await query(
    `SELECT COUNT(DISTINCT phone)::INTEGER AS total
     FROM onboarding_outreach_queue
     WHERE status = 'sent' AND sent_at >= $1`,
    [since]
  );
  return Number(result.rows[0]?.total || 0);
}

async function markQueueFailed(queueIdOrRow, queueData, error) {
  const queueId = typeof queueIdOrRow === 'string' ? queueIdOrRow : queueIdOrRow?.id;
  const attempts = Number(queueData?.attempts || 0) + 1;
  const permanentFailure = attempts >= MAX_ATTEMPTS;
  const now = nowDate();

  await query(
    `UPDATE onboarding_outreach_queue
     SET status = $2,
         attempts = $3,
         last_error = $4,
         locked_at = NULL,
         next_run_at = $5,
         updated_at = $6
     WHERE id = $1`,
    [
      queueId,
      permanentFailure ? 'failed' : 'pending',
      attempts,
      error?.message || String(error),
      permanentFailure ? null : new Date(now.getTime() + Math.min(60 * 60 * 1000, attempts * attempts * 5 * 60 * 1000)),
      now
    ]
  );
}

async function recoverStaleProcessingJobs() {
  const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS);
  const result = await query(
    `UPDATE onboarding_outreach_queue
     SET status = 'pending',
         locked_at = NULL,
         last_error = 'Recovered stale processing lock',
         next_run_at = NOW(),
         updated_at = NOW()
     WHERE status = 'processing'
       AND locked_at IS NOT NULL
       AND locked_at < $1`,
    [staleBefore]
  );
  return result.rowCount || 0;
}

async function validateClaimToken({ rawToken }) {
  if (!rawToken) return { valid: false, code: 'TOKEN_REQUIRED' };

  const result = await query(
    `SELECT *
     FROM advert_claim_tokens
     WHERE token_hash = $1
     LIMIT 1`,
    [hashToken(rawToken)]
  );

  if (result.rowCount === 0) return { valid: false, code: 'INVALID_TOKEN' };
  const data = result.rows[0];
  const expiresAt = toDate(data.expires_at);

  if (data.claimed_at) return { valid: false, code: 'TOKEN_ALREADY_CLAIMED' };
  if (!expiresAt || expiresAt.getTime() <= Date.now()) return { valid: false, code: 'TOKEN_EXPIRED' };

  return {
    valid: true,
    tokenId: data.id,
    advertId: data.advert_id,
    collectionName: data.collection_name,
    expiresAt
  };
}

async function claimAdvertWithToken({ rawToken, userId }) {
  if (!rawToken || !userId) {
    throw new Error('Token and authenticated user are required.');
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const tokenResult = await client.query(
      `SELECT *
       FROM advert_claim_tokens
       WHERE token_hash = $1
       LIMIT 1
       FOR UPDATE`,
      [hashToken(rawToken)]
    );

    if (tokenResult.rowCount === 0) {
      const err = new Error('Invalid or expired claim link.');
      err.code = 'INVALID_TOKEN';
      throw err;
    }

    const tokenData = tokenResult.rows[0];
    const expiresAt = toDate(tokenData.expires_at);
    if (tokenData.claimed_at) {
      const err = new Error('This advert has already been claimed.');
      err.code = 'TOKEN_ALREADY_CLAIMED';
      throw err;
    }
    if (!expiresAt || expiresAt.getTime() <= Date.now()) {
      const err = new Error('This claim link has expired.');
      err.code = 'TOKEN_EXPIRED';
      throw err;
    }

    const advertResult = await client.query(
      `SELECT *
       FROM public_listings
       WHERE collection_name = $1 AND id = $2
       LIMIT 1
       FOR UPDATE`,
      [tokenData.collection_name, tokenData.advert_id]
    );

    if (advertResult.rowCount === 0) {
      const err = new Error('Advert not found.');
      err.code = 'ADVERT_NOT_FOUND';
      throw err;
    }

    const advert = rowToListing(advertResult.rows[0]);
    if (!isUnclaimedImportedListing(advert)) {
      const err = new Error('This advert is no longer available to claim.');
      err.code = 'ADVERT_NOT_CLAIMABLE';
      throw err;
    }

    const now = nowDate();
    await client.query(
      `UPDATE public_listings
       SET user_id = $3::text,
           status = 'active',
           updated_at = $4::timestamptz,
           data = data || jsonb_build_object(
             'userId', $3::text,
             'claimedAt', $5::text,
             'claimedVia', 'whatsapp_onboarding',
             'status', 'active',
             'updatedAt', $5::text
           )
       WHERE collection_name = $1 AND id = $2`,
      [tokenData.collection_name, tokenData.advert_id, userId, now, now.toISOString()]
    );

    await client.query(
      `UPDATE advert_claim_tokens
       SET claimed_at = $2,
           claimed_by_user_id = $3,
           updated_at = $2
       WHERE id = $1`,
      [tokenData.id, now, userId]
    );

    await client.query(
      `UPDATE onboarding_outreach_queue
       SET status = 'claimed',
           claimed_at = $3,
           claimed_by_user_id = $4,
           updated_at = $3
       WHERE collection_name = $1 AND advert_id = $2`,
      [tokenData.collection_name, tokenData.advert_id, now, userId]
    );

    await client.query('COMMIT');

    return {
      advertId: tokenData.advert_id,
      collectionName: tokenData.collection_name,
      redirectUrl: `/dashboard/edit-property/${tokenData.advert_id}?claimAccess=1`
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function resolveBatchListings(advertRefs = [], claimedAdvertIds = []) {
  const claimedSet = new Set((claimedAdvertIds || []).map(String));
  const listings = [];

  for (const ref of advertRefs.slice(0, MAX_BATCH_ADVERTS)) {
    const listing = await fetchListing(null, ref.collectionName, ref.advertId);
    listings.push({
      advertId: ref.advertId,
      collectionName: ref.collectionName,
      title: listing?.title || ref.title || 'Property Listing',
      location: resolveListingLocation(listing || {}) || ref.location || '',
      imageUrl: Array.isArray(listing?.imageUrls) ? listing.imageUrls[0] || '' : '',
      alreadyClaimed: claimedSet.has(String(ref.advertId)) || !isUnclaimedImportedListing(listing || {}),
      exists: Boolean(listing)
    });
  }

  return listings;
}

async function validateBatchClaimToken({ rawToken }) {
  if (!rawToken) return { valid: false, code: 'TOKEN_REQUIRED' };

  const result = await query(
    `SELECT *
     FROM advert_claim_batches
     WHERE token_hash = $1
     LIMIT 1`,
    [hashToken(rawToken)]
  );

  if (result.rowCount === 0) return { valid: false, code: 'INVALID_TOKEN' };

  const data = batchRowToData(result.rows[0]);
  const expiresAt = toDate(data.expiresAt);
  if (!expiresAt || expiresAt.getTime() <= Date.now()) return { valid: false, code: 'TOKEN_EXPIRED' };

  const listings = await resolveBatchListings(data.advertRefs || [], data.claimedAdvertIds || []);
  const claimableCount = listings.filter((item) => item.exists && !item.alreadyClaimed).length;

  if (claimableCount === 0) {
    return { valid: false, code: 'BATCH_ALREADY_CLAIMED', tokenId: data.id, listings };
  }

  return {
    valid: true,
    tokenId: data.id,
    phone: data.phone || '',
    advertCount: listings.length,
    claimableCount,
    expiresAt,
    listings
  };
}

async function claimBatchWithToken({ rawToken, userId, advertIds = null }) {
  if (!rawToken || !userId) {
    throw new Error('Token and authenticated user are required.');
  }

  const requestedIds = Array.isArray(advertIds) && advertIds.length
    ? new Set(advertIds.map(String))
    : null;

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const batchResult = await client.query(
      `SELECT *
       FROM advert_claim_batches
       WHERE token_hash = $1
       LIMIT 1
       FOR UPDATE`,
      [hashToken(rawToken)]
    );

    if (batchResult.rowCount === 0) {
      const err = new Error('Invalid or expired claim link.');
      err.code = 'INVALID_TOKEN';
      throw err;
    }

    const batchData = batchRowToData(batchResult.rows[0]);
    const expiresAt = toDate(batchData.expiresAt);
    if (!expiresAt || expiresAt.getTime() <= Date.now()) {
      const err = new Error('This batch claim link has expired.');
      err.code = 'TOKEN_EXPIRED';
      throw err;
    }

    const alreadyClaimed = new Set((batchData.claimedAdvertIds || []).map(String));
    const advertRefs = (batchData.advertRefs || [])
      .filter((ref) => !requestedIds || requestedIds.has(String(ref.advertId)))
      .filter((ref) => !alreadyClaimed.has(String(ref.advertId)))
      .slice(0, MAX_BATCH_ADVERTS);

    if (!advertRefs.length) {
      const err = new Error('No claimable adverts were selected.');
      err.code = 'NO_CLAIMABLE_ADVERTS';
      throw err;
    }

    const now = nowDate();
    const claimedIds = [];

    for (const ref of advertRefs) {
      const advertResult = await client.query(
        `SELECT *
         FROM public_listings
         WHERE collection_name = $1 AND id = $2
         LIMIT 1
         FOR UPDATE`,
        [ref.collectionName, ref.advertId]
      );
      if (advertResult.rowCount === 0) continue;

      const advert = rowToListing(advertResult.rows[0]);
      if (!isUnclaimedImportedListing(advert)) continue;

      await client.query(
      `UPDATE public_listings
         SET user_id = $3::text,
             status = 'active',
             updated_at = $4::timestamptz,
             data = data || jsonb_build_object(
               'userId', $3::text,
               'claimedAt', $5::text,
               'claimedVia', 'whatsapp_onboarding_batch',
               'status', 'active',
               'updatedAt', $5::text
             )
         WHERE collection_name = $1 AND id = $2`,
        [ref.collectionName, ref.advertId, userId, now, now.toISOString()]
      );
      claimedIds.push(ref.advertId);
    }

    if (!claimedIds.length) {
      const err = new Error('Selected adverts are no longer available to claim.');
      err.code = 'ADVERT_NOT_CLAIMABLE';
      throw err;
    }

    const mergedClaimedIds = Array.from(new Set([...alreadyClaimed, ...claimedIds.map(String)]));
    const allIds = (batchData.advertRefs || []).map((ref) => String(ref.advertId));
    const allClaimed = allIds.length > 0 && allIds.every((id) => mergedClaimedIds.includes(id));

    await client.query(
      `UPDATE advert_claim_batches
       SET claimed_advert_ids = $2::text[],
           claimed_at = $3::timestamptz,
           claimed_by_user_id = $4::text,
           updated_at = $5::timestamptz
       WHERE id = $1`,
      [batchData.id, mergedClaimedIds, allClaimed ? now : batchData.claimedAt, userId, now]
    );

    await client.query(
      `UPDATE onboarding_outreach_queue
       SET status = 'claimed',
           claimed_at = $2,
           claimed_by_user_id = $3,
           updated_at = $2
       WHERE batch_token_id = $1
         AND advert_id = ANY($4::text[])`,
      [batchData.id, now, userId, claimedIds.map(String)]
    );

    await client.query('COMMIT');

    return {
      batchId: batchData.id,
      claimedAdvertIds: claimedIds,
      claimedCount: claimedIds.length,
      totalAdvertCount: allIds.length,
      allClaimed,
      redirectUrl: '/dashboard?tab=my-ads&claimAccess=1'
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  buildSuppressedNumberId,
  createBatchClaimToken,
  createClaimToken,
  createOnboardingQueueItem,
  claimBatchWithToken,
  claimAdvertWithToken,
  countSentMessagesSince,
  fetchListing,
  getAppUrl,
  getLocationPriority,
  hashToken,
  isNumberSuppressed,
  isUnclaimedImportedListing,
  markQueueFailed,
  markQueueSuppressed,
  normalizePhoneNumber,
  queueRowToItem,
  randomDelayMs,
  recoverStaleProcessingJobs,
  resolveAgentName,
  resolveAgentPhone,
  resolveBatchListings,
  resolveListingLocation,
  suppressNumber,
  toDate,
  validateBatchClaimToken,
  validateClaimToken
};
