const crypto = require('crypto');
const { FieldValue } = require('firebase-admin/firestore');
const { getAutomationFirestore } = require('./admin-firestore');

const CLAIM_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const STALE_PROCESSING_MS = 10 * 60 * 1000;
const PRIORITY_LOCATIONS = ['lagos', 'abuja', 'port harcourt'];

function nowDate() {
  return new Date();
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
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

function normalizeLocationText(value) {
  return String(value || '')
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
  const userId = String(listing.userId || listing.agent?.id || '').trim().toLowerCase();
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
    const collectionName = item.collectionName || item.listing?.collectionName || 'properties';
    const advertId = item.advertId || item.id || item.listing?.id;
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

  return refs.slice(0, 20);
}

async function fetchListing(db, collectionName, advertId) {
  const snapshot = await db.collection(collectionName).doc(advertId).get();
  if (!snapshot.exists) return null;
  return { id: snapshot.id, ...snapshot.data() };
}

async function createClaimToken({ db = getAutomationFirestore(), collectionName, advertId }) {
  const rawToken = createRawToken();
  const now = nowDate();
  const expiresAt = new Date(now.getTime() + CLAIM_TOKEN_TTL_MS);
  const docRef = db.collection('advertClaimTokens').doc();

  await docRef.set({
    advertId,
    collectionName,
    tokenHash: hashToken(rawToken),
    expiresAt,
    claimedAt: null,
    claimedByUserId: null,
    createdAt: now,
    updatedAt: now
  });

  return {
    id: docRef.id,
    rawToken,
    claimUrl: `${getAppUrl()}/claim?token=${encodeURIComponent(rawToken)}`,
    manageUrl: `${getAppUrl()}/claim/manage?token=${encodeURIComponent(rawToken)}`,
    expiresAt
  };
}

async function createBatchClaimToken({
  db = getAutomationFirestore(),
  phone,
  queueItems = [],
  listings = []
}) {
  const rawToken = createRawToken();
  const now = nowDate();
  const expiresAt = new Date(now.getTime() + CLAIM_TOKEN_TTL_MS);
  const docRef = db.collection('advertClaimBatches').doc();
  const listingById = new Map(listings.map((listing) => [String(listing.id), listing]));
  const advertRefs = uniqueAdvertRefs(queueItems.map((item) => {
    const listing = listingById.get(String(item.advertId)) || {};
    return {
      ...item,
      title: listing.title || item.title,
      location: resolveListingLocation(listing) || item.location
    };
  }));

  await docRef.set({
    phone: buildSuppressedNumberId(phone),
    rawPhone: phone || null,
    advertRefs,
    advertCount: advertRefs.length,
    tokenHash: hashToken(rawToken),
    expiresAt,
    sentAt: null,
    claimedAt: null,
    claimedByUserId: null,
    claimedAdvertIds: [],
    createdAt: now,
    updatedAt: now
  });

  return {
    id: docRef.id,
    rawToken,
    claimUrl: `${getAppUrl()}/claim/batch?token=${encodeURIComponent(rawToken)}`,
    expiresAt,
    advertRefs
  };
}

async function createOnboardingQueueItem({
  db = getAutomationFirestore(),
  collectionName,
  advertId,
  listing = null,
  force = false
}) {
  if (collectionName !== 'properties' || !advertId) {
    return { queued: false, reason: 'unsupported_collection' };
  }

  const resolvedListing = listing || await fetchListing(db, collectionName, advertId);
  if (!resolvedListing) return { queued: false, reason: 'listing_not_found' };
  if (!force && !isUnclaimedImportedListing(resolvedListing)) {
    return { queued: false, reason: 'not_imported_or_already_owned' };
  }

  const phone = resolveAgentPhone(resolvedListing);
  if (!phone) return { queued: false, reason: 'missing_valid_phone' };

  const docId = buildQueueDocId(collectionName, advertId, phone);
  const queueRef = db.collection('onboardingOutreachQueue').doc(docId);

  const now = nowDate();
  const location = resolveListingLocation(resolvedListing);
  try {
    await queueRef.create({
      advertId,
      collectionName,
      phone,
      agentName: resolveAgentName(resolvedListing),
      location,
      priority: getLocationPriority(location),
      status: 'pending',
      claimTokenId: null,
      attempts: 0,
      lastError: null,
      lockedAt: null,
      nextRunAt: new Date(now.getTime() + randomDelayMs(30, 60)),
      sentAt: null,
      createdAt: now,
      updatedAt: now
    });
  } catch (error) {
    if (error?.code === 6 || /already exists/i.test(error?.message || '')) {
      return { queued: false, reason: 'already_queued', queueId: docId };
    }
    throw error;
  }

  return { queued: true, queueId: docId, phone };
}

async function isNumberSuppressed({ db = getAutomationFirestore(), phone }) {
  const suppressedId = buildSuppressedNumberId(phone);
  if (!suppressedId) return false;

  const doc = await db.collection('suppressedNumbers').doc(suppressedId).get();
  return doc.exists;
}

async function suppressNumber({
  db = getAutomationFirestore(),
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
  await db.collection('suppressedNumbers').doc(suppressedId).set({
    phone: suppressedId,
    source,
    reason,
    rawPhone: phone || null,
    rawPayload: rawPayload ? JSON.stringify(rawPayload).slice(0, 5000) : null,
    createdAt: now,
    updatedAt: now
  }, { merge: true });

  return { suppressed: true, phone: suppressedId };
}

async function markQueueSuppressed(queueRef, phone) {
  const now = nowDate();
  await queueRef.update({
    status: 'suppressed',
    suppressedAt: now,
    suppressedPhone: buildSuppressedNumberId(phone),
    lockedAt: null,
    lastError: 'Phone number opted out',
    updatedAt: now
  });
}

async function countSentMessagesSince({ db = getAutomationFirestore(), since }) {
  const snapshot = await db.collection('onboardingOutreachQueue')
    .where('sentAt', '>=', since)
    .limit(1000)
    .get();

  let count = 0;
  snapshot.forEach((doc) => {
    if (doc.data().status === 'sent') count += 1;
  });

  return count;
}

async function markQueueFailed(queueRef, queueData, error) {
  const attempts = Number(queueData.attempts || 0) + 1;
  const permanentFailure = attempts >= MAX_ATTEMPTS;
  const now = nowDate();

  await queueRef.update({
    status: permanentFailure ? 'failed' : 'pending',
    attempts,
    lastError: error?.message || String(error),
    lockedAt: null,
    nextRunAt: permanentFailure
      ? null
      : new Date(now.getTime() + Math.min(60 * 60 * 1000, attempts * attempts * 5 * 60 * 1000)),
    updatedAt: now
  });
}

async function recoverStaleProcessingJobs(db = getAutomationFirestore()) {
  const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS);
  const snapshot = await db.collection('onboardingOutreachQueue')
    .where('status', '==', 'processing')
    .limit(25)
    .get();

  const updates = [];
  snapshot.forEach((doc) => {
    const lockedAt = toDate(doc.data().lockedAt);
    if (lockedAt && lockedAt < staleBefore) {
      updates.push(doc.ref.update({
        status: 'pending',
        lockedAt: null,
        lastError: 'Recovered stale processing lock',
        nextRunAt: nowDate(),
        updatedAt: nowDate()
      }));
    }
  });

  await Promise.all(updates);
  return updates.length;
}

async function claimAdvertWithToken({ db = getAutomationFirestore(), rawToken, userId }) {
  if (!rawToken || !userId) {
    throw new Error('Token and authenticated user are required.');
  }

  const tokenHash = hashToken(rawToken);
  const tokenSnapshot = await db.collection('advertClaimTokens')
    .where('tokenHash', '==', tokenHash)
    .limit(1)
    .get();

  if (tokenSnapshot.empty) {
    const err = new Error('Invalid or expired claim link.');
    err.code = 'INVALID_TOKEN';
    throw err;
  }

  const tokenDoc = tokenSnapshot.docs[0];
  const tokenRef = tokenDoc.ref;

  return db.runTransaction(async (transaction) => {
    const lockedTokenDoc = await transaction.get(tokenRef);
    const tokenData = lockedTokenDoc.data();
    const expiresAt = toDate(tokenData.expiresAt);

    if (tokenData.claimedAt) {
      const err = new Error('This advert has already been claimed.');
      err.code = 'TOKEN_ALREADY_CLAIMED';
      throw err;
    }

    if (!expiresAt || expiresAt.getTime() <= Date.now()) {
      const err = new Error('This claim link has expired.');
      err.code = 'TOKEN_EXPIRED';
      throw err;
    }

    const advertRef = db.collection(tokenData.collectionName).doc(tokenData.advertId);
    const advertDoc = await transaction.get(advertRef);

    if (!advertDoc.exists) {
      const err = new Error('Advert not found.');
      err.code = 'ADVERT_NOT_FOUND';
      throw err;
    }

    const advertData = advertDoc.data();
    if (!isUnclaimedImportedListing(advertData)) {
      const err = new Error('This advert is no longer available to claim.');
      err.code = 'ADVERT_NOT_CLAIMABLE';
      throw err;
    }

    const now = nowDate();
    transaction.update(advertRef, {
      userId,
      claimedAt: now,
      claimedVia: 'whatsapp_onboarding',
      status: 'active',
      updatedAt: now
    });

    transaction.update(tokenRef, {
      claimedAt: now,
      claimedByUserId: userId,
      updatedAt: now
    });

    return {
      advertId: tokenData.advertId,
      collectionName: tokenData.collectionName,
      redirectUrl: `/dashboard/edit-property/${tokenData.advertId}?claimAccess=1`
    };
  });
}

async function validateClaimToken({ db = getAutomationFirestore(), rawToken }) {
  if (!rawToken) return { valid: false, code: 'TOKEN_REQUIRED' };

  const snapshot = await db.collection('advertClaimTokens')
    .where('tokenHash', '==', hashToken(rawToken))
    .limit(1)
    .get();

  if (snapshot.empty) return { valid: false, code: 'INVALID_TOKEN' };

  const doc = snapshot.docs[0];
  const data = doc.data();
  const expiresAt = toDate(data.expiresAt);

  if (data.claimedAt) return { valid: false, code: 'TOKEN_ALREADY_CLAIMED' };
  if (!expiresAt || expiresAt.getTime() <= Date.now()) return { valid: false, code: 'TOKEN_EXPIRED' };

  return {
    valid: true,
    tokenId: doc.id,
    advertId: data.advertId,
    collectionName: data.collectionName,
    expiresAt
  };
}

async function resolveBatchListings(db, advertRefs = [], claimedAdvertIds = []) {
  const claimedSet = new Set((claimedAdvertIds || []).map(String));
  const listings = [];

  for (const ref of advertRefs.slice(0, 20)) {
    const advertDoc = await db.collection(ref.collectionName).doc(ref.advertId).get();
    const data = advertDoc.exists ? advertDoc.data() || {} : {};
    listings.push({
      advertId: ref.advertId,
      collectionName: ref.collectionName,
      title: data.title || ref.title || 'Property Listing',
      location: resolveListingLocation(data) || ref.location || '',
      imageUrl: Array.isArray(data.imageUrls) ? data.imageUrls[0] || '' : '',
      alreadyClaimed: claimedSet.has(String(ref.advertId)) || !isUnclaimedImportedListing(data),
      exists: advertDoc.exists
    });
  }

  return listings;
}

async function validateBatchClaimToken({ db = getAutomationFirestore(), rawToken }) {
  if (!rawToken) return { valid: false, code: 'TOKEN_REQUIRED' };

  const snapshot = await db.collection('advertClaimBatches')
    .where('tokenHash', '==', hashToken(rawToken))
    .limit(1)
    .get();

  if (snapshot.empty) return { valid: false, code: 'INVALID_TOKEN' };

  const doc = snapshot.docs[0];
  const data = doc.data();
  const expiresAt = toDate(data.expiresAt);

  if (!expiresAt || expiresAt.getTime() <= Date.now()) return { valid: false, code: 'TOKEN_EXPIRED' };

  const listings = await resolveBatchListings(db, data.advertRefs || [], data.claimedAdvertIds || []);
  const claimableCount = listings.filter((item) => item.exists && !item.alreadyClaimed).length;

  if (claimableCount === 0) {
    return { valid: false, code: 'BATCH_ALREADY_CLAIMED', tokenId: doc.id, listings };
  }

  return {
    valid: true,
    tokenId: doc.id,
    phone: data.phone || '',
    advertCount: listings.length,
    claimableCount,
    expiresAt,
    listings
  };
}

async function claimBatchWithToken({
  db = getAutomationFirestore(),
  rawToken,
  userId,
  advertIds = null
}) {
  if (!rawToken || !userId) {
    throw new Error('Token and authenticated user are required.');
  }

  const tokenHash = hashToken(rawToken);
  const tokenSnapshot = await db.collection('advertClaimBatches')
    .where('tokenHash', '==', tokenHash)
    .limit(1)
    .get();

  if (tokenSnapshot.empty) {
    const err = new Error('Invalid or expired claim link.');
    err.code = 'INVALID_TOKEN';
    throw err;
  }

  const batchDoc = tokenSnapshot.docs[0];
  const batchRef = batchDoc.ref;
  const requestedIds = Array.isArray(advertIds) && advertIds.length
    ? new Set(advertIds.map(String))
    : null;

  const result = await db.runTransaction(async (transaction) => {
    const lockedBatchDoc = await transaction.get(batchRef);
    const batchData = lockedBatchDoc.data();
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
      .slice(0, 20);

    if (!advertRefs.length) {
      const err = new Error('No claimable adverts were selected.');
      err.code = 'NO_CLAIMABLE_ADVERTS';
      throw err;
    }

    const now = nowDate();
    const claimedIds = [];

    for (const ref of advertRefs) {
      const advertRef = db.collection(ref.collectionName).doc(ref.advertId);
      const advertDoc = await transaction.get(advertRef);
      if (!advertDoc.exists || !isUnclaimedImportedListing(advertDoc.data())) continue;

      transaction.update(advertRef, {
        userId,
        claimedAt: now,
        claimedVia: 'whatsapp_onboarding_batch',
        status: 'active',
        updatedAt: now
      });
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

    transaction.update(batchRef, {
      claimedAdvertIds: mergedClaimedIds,
      claimedAt: allClaimed ? now : batchData.claimedAt || null,
      claimedByUserId: userId,
      updatedAt: now
    });

    return {
      batchId: batchDoc.id,
      claimedAdvertIds: claimedIds,
      claimedCount: claimedIds.length,
      totalAdvertCount: allIds.length,
      allClaimed,
      redirectUrl: '/dashboard?tab=my-ads&claimAccess=1'
    };
  });

  const queueSnapshot = await db.collection('onboardingOutreachQueue')
    .where('batchTokenId', '==', result.batchId)
    .limit(100)
    .get();

  await Promise.all(queueSnapshot.docs
    .filter((doc) => result.claimedAdvertIds.includes(doc.data().advertId))
    .map((doc) => doc.ref.update({
      status: 'claimed',
      claimedAt: nowDate(),
      claimedByUserId: userId,
      updatedAt: nowDate()
    }).catch(() => null)));

  return result;
}

module.exports = {
  createBatchClaimToken,
  createClaimToken,
  createOnboardingQueueItem,
  claimBatchWithToken,
  claimAdvertWithToken,
  countSentMessagesSince,
  fetchListing,
  getLocationPriority,
  getAppUrl,
  hashToken,
  isNumberSuppressed,
  isUnclaimedImportedListing,
  markQueueSuppressed,
  normalizePhoneNumber,
  randomDelayMs,
  recoverStaleProcessingJobs,
  resolveAgentName,
  resolveAgentPhone,
  resolveListingLocation,
  suppressNumber,
  validateBatchClaimToken,
  validateClaimToken,
  markQueueFailed,
  toDate,
  FieldValue
};
