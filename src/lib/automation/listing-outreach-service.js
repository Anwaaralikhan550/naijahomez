const fs = require('fs');
const path = require('path');
const { generateBatchListingClaimMessage, generateListingClaimMessage } = require('./message-template');
const { sendWhatsAppTextMessage } = require('../whatsapp/evolution-client');
const { getAutomationFirestore } = require('./admin-firestore');
const postgresOutreachService = require('./listing-outreach-service-postgres.cjs');
const {
  countSentMessagesSince,
  createBatchClaimToken,
  createClaimToken,
  fetchListing,
  getLocationPriority,
  isNumberSuppressed,
  markQueueFailed,
  markQueueSuppressed,
  normalizePhoneNumber,
  randomDelayMs,
  recoverStaleProcessingJobs,
  resolveAgentPhone,
  resolveListingLocation,
  shouldUsePostgresOnboarding,
  toDate
} = require('./onboarding-queue-adapter.cjs');

const SCRAPED_LISTINGS_FILE = path.resolve(process.cwd(), 'firestore-properties.json');
const DEFAULT_MAX_DAILY_MESSAGES = 100;
const DEFAULT_MAX_HOURLY_MESSAGES = 15;
const MAX_BATCH_ADVERTS = 20;

function readScrapedListings() {
  try {
    const raw = fs.readFileSync(SCRAPED_LISTINGS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error('Expected scraped listings JSON to be an array.');
    }
    return parsed;
  } catch (error) {
    throw new Error(`Failed to read scraped listings from ${SCRAPED_LISTINGS_FILE}: ${error.message}`);
  }
}

function selectListingForOutreach(listings, { listingId, overridePhone }) {
  if (listingId) {
    const found = listings.find((listing) => String(listing.id) === String(listingId));
    if (!found) {
      throw new Error(`No listing found with id "${listingId}".`);
    }
    return {
      listing: found,
      phone: overridePhone || resolveAgentPhone(found)
    };
  }

  for (const listing of listings) {
    const phone = overridePhone || resolveAgentPhone(listing);
    if (phone) {
      return { listing, phone };
    }
  }

  return { listing: null, phone: null };
}

function mergeAdvertRefs(existingRefs = [], newRefs = []) {
  const merged = [];
  const seen = new Set();

  [...existingRefs, ...newRefs].forEach((ref) => {
    if (!ref?.collectionName || !ref?.advertId) return;
    const key = `${ref.collectionName}:${ref.advertId}`;
    if (seen.has(key) || merged.length >= MAX_BATCH_ADVERTS) return;
    seen.add(key);
    merged.push({
      collectionName: ref.collectionName,
      advertId: ref.advertId,
      title: ref.title || '',
      location: ref.location || ''
    });
  });

  return merged;
}

async function loadQueueGroupForPhone(db, phone, lockedQueueId) {
  const normalizedPhone = normalizePhoneNumber(phone) || phone;
  const now = new Date();
  const snapshot = await db.collection('onboardingOutreachQueue')
    .where('phone', '==', normalizedPhone)
    .limit(100)
    .get();

  const docs = [];
  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    const nextRunAt = toDate(data.nextRunAt);
    const isLocked = doc.id === lockedQueueId;
    const isDuePending = data.status === 'pending' && (!nextRunAt || nextRunAt <= now);
    const isProcessing = data.status === 'processing' && isLocked;

    if ((isDuePending || isProcessing) && docs.length < MAX_BATCH_ADVERTS) {
      docs.push(doc);
    }
  });

  if (!docs.some((doc) => doc.id === lockedQueueId)) {
    const lockedDoc = await db.collection('onboardingOutreachQueue').doc(lockedQueueId).get();
    if (lockedDoc.exists) docs.unshift(lockedDoc);
  }

  const items = docs.slice(0, MAX_BATCH_ADVERTS).map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));

  const listings = await Promise.all(items.map((item) =>
    fetchListing(db, item.collectionName, item.advertId).catch(() => null)
  ));

  return {
    docs: docs.slice(0, MAX_BATCH_ADVERTS),
    items,
    listings: listings.filter(Boolean)
  };
}

async function findRecentBatchForPhone(db, phone) {
  const normalizedPhone = normalizePhoneNumber(phone) || phone;
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const snapshot = await db.collection('advertClaimBatches')
    .where('phone', '==', normalizedPhone)
    .limit(10)
    .get();

  let recent = null;
  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    const sentAt = toDate(data.sentAt);
    const expiresAt = toDate(data.expiresAt);
    if (!sentAt || sentAt.getTime() < since || data.claimedAt) return;
    if (!expiresAt || expiresAt.getTime() <= Date.now()) return;
    if (!recent || sentAt > recent.sentAt) {
      recent = { id: doc.id, ref: doc.ref, data, sentAt };
    }
  });

  return recent;
}

async function markQueueGroupSuppressed(db, phone) {
  const normalizedPhone = normalizePhoneNumber(phone) || phone;
  const snapshot = await db.collection('onboardingOutreachQueue')
    .where('phone', '==', normalizedPhone)
    .limit(100)
    .get();

  await Promise.all(snapshot.docs
    .filter((doc) => ['pending', 'processing'].includes(doc.data().status))
    .map((doc) => markQueueSuppressed(doc.ref, normalizedPhone).catch(() => null)));
}

async function markQueueGroupBatched(docs, batchTokenId, reason) {
  const now = new Date();
  await Promise.all(docs.map((doc) => doc.ref.update({
    status: 'batched',
    batchTokenId,
    batchedAt: now,
    lockedAt: null,
    lastError: reason || null,
    updatedAt: now
  })));
}

async function markQueueGroupSent(docs, { claimTokenId, batchTokenId, providerMessageId }) {
  const now = new Date();
  await Promise.all(docs.map((doc, index) => doc.ref.update({
    status: index === 0 ? 'sent' : 'batched',
    claimTokenId: index === 0 ? claimTokenId : null,
    batchTokenId,
    sentAt: now,
    lockedAt: null,
    lastError: null,
    providerMessageId: index === 0 ? providerMessageId : null,
    updatedAt: now
  })));
}

async function runQueueItem(queueId, { dryRun = false } = {}) {
  if (shouldUsePostgresOnboarding()) {
    return postgresOutreachService.runQueueItem(queueId, { dryRun });
  }

  const db = getAutomationFirestore();
  const queueRef = db.collection('onboardingOutreachQueue').doc(queueId);
  const queueDoc = await queueRef.get();

  if (!queueDoc.exists) {
    throw new Error(`Queue item "${queueId}" was not found.`);
  }

  const queueData = queueDoc.data();
  const listing = await fetchListing(db, queueData.collectionName, queueData.advertId);
  if (!listing) {
    throw new Error(`Advert "${queueData.advertId}" was not found.`);
  }

  const phone = queueData.phone || resolveAgentPhone(listing);
  if (!phone) {
    throw new Error(`No valid phone number found for advert "${queueData.advertId}".`);
  }

  if (await isNumberSuppressed({ db, phone })) {
    if (!dryRun) {
      await markQueueGroupSuppressed(db, phone);
    }
    return {
      success: true,
      suppressed: true,
      sent: false,
      dryRun,
      queueId,
      listingId: queueData.advertId,
      to: phone
    };
  }

  const group = await loadQueueGroupForPhone(db, phone, queueId);
  const recentBatch = !dryRun ? await findRecentBatchForPhone(db, phone) : null;

  if (recentBatch) {
    const batchItems = group.items.map((item) => ({
      collectionName: item.collectionName,
      advertId: item.advertId,
      title: item.title || '',
      location: item.location || ''
    }));

    await recentBatch.ref.set({
      advertRefs: mergeAdvertRefs(recentBatch.data.advertRefs || [], batchItems),
      advertCount: mergeAdvertRefs(recentBatch.data.advertRefs || [], batchItems).length,
      updatedAt: new Date()
    }, { merge: true });

    await markQueueGroupBatched(group.docs, recentBatch.id, 'Existing message sent in the last 24 hours');

    return {
      success: true,
      sent: false,
      batched: true,
      dryRun,
      queueId,
      listingId: queueData.advertId,
      batchTokenId: recentBatch.id,
      batchedCount: group.items.length,
      to: phone
    };
  }

  const claimToken = dryRun
    ? {
        id: queueData.batchTokenId || queueData.claimTokenId || null,
        claimUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${group.items.length > 1 ? '/claim/batch' : '/claim'}?token=dry-run-token`,
        advertRefs: group.items
      }
    : group.items.length > 1
      ? await createBatchClaimToken({
          db,
          phone,
          queueItems: group.items,
          listings: group.listings
        })
      : await createClaimToken({
        db,
        collectionName: queueData.collectionName,
        advertId: queueData.advertId
      });

  const title = listing.title || listing.name || 'Property Listing';
  const message = group.items.length > 1
    ? generateBatchListingClaimMessage({
        count: group.items.length,
        claimUrl: claimToken.claimUrl
      })
    : generateListingClaimMessage({
        title,
        claimUrl: claimToken.claimUrl,
        manageUrl: claimToken.manageUrl
      });

  if (dryRun) {
    await queueRef.update({
      status: queueData.status === 'processing' ? 'pending' : queueData.status,
      lockedAt: null,
      lastError: null,
      updatedAt: new Date()
    }).catch(() => null);

    return {
      success: true,
      dryRun: true,
      queueId,
      listingId: queueData.advertId,
      to: phone,
      claimUrl: claimToken.claimUrl,
      message,
      batchedCount: group.items.length,
      sent: false
    };
  }

  try {
    const providerResponse = await sendWhatsAppTextMessage({
      to: phone,
      text: message,
      previewUrl: Boolean(claimToken.manageUrl || claimToken.claimUrl)
    });

    const providerMessageId =
      providerResponse?.key?.id ||
      providerResponse?.messageId ||
      providerResponse?.id ||
      null;
    await markQueueGroupSent(group.docs, {
      claimTokenId: group.items.length > 1 ? null : claimToken.id,
      batchTokenId: group.items.length > 1 ? claimToken.id : null,
      providerMessageId
    });
    if (group.items.length > 1) {
      await db.collection('advertClaimBatches').doc(claimToken.id).set({
        sentAt: new Date(),
        providerMessageId,
        updatedAt: new Date()
      }, { merge: true });
    }

    return {
      success: true,
      sent: true,
      dryRun: false,
      queueId,
      listingId: queueData.advertId,
      batchTokenId: group.items.length > 1 ? claimToken.id : null,
      batchedCount: group.items.length,
      to: phone,
      message,
      providerResponse
    };
  } catch (error) {
    await markQueueFailed(queueRef, queueData, error);
    throw error;
  }
}

async function lockNextQueueItem(db) {
  const snapshot = await db.collection('onboardingOutreachQueue')
    .where('status', '==', 'pending')
    .limit(50)
    .get();

  const now = new Date();
  const dueCandidates = snapshot.docs
    .filter((doc) => {
      const nextRunAt = toDate(doc.data().nextRunAt);
      return !nextRunAt || nextRunAt <= now;
    });

  const scoredCandidates = await Promise.all(dueCandidates.map(async (doc) => {
    const data = doc.data();
    let location = data.location;
    let priority = Number.isFinite(Number(data.priority))
      ? Number(data.priority)
      : getLocationPriority(location);

    if (!location && data.collectionName && data.advertId) {
      const listing = await fetchListing(db, data.collectionName, data.advertId).catch(() => null);
      location = resolveListingLocation(listing || {});
      priority = getLocationPriority(location);

      if (location) {
        await doc.ref.set({ location, priority, updatedAt: now }, { merge: true }).catch(() => null);
      }
    }

    return {
      doc,
      priority,
      createdAt: toDate(data.createdAt)?.getTime() || 0
    };
  }));

  scoredCandidates.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.createdAt - b.createdAt;
  });

  const candidate = scoredCandidates[0]?.doc;

  if (!candidate) return null;

  const locked = await db.runTransaction(async (transaction) => {
    const freshDoc = await transaction.get(candidate.ref);
    if (!freshDoc.exists) return null;

    const data = freshDoc.data();
    const nextRunAt = toDate(data.nextRunAt);
    if (data.status !== 'pending' || (nextRunAt && nextRunAt > now)) {
      return null;
    }

    transaction.update(candidate.ref, {
      status: 'processing',
      lockedAt: now,
      updatedAt: now
    });

    return candidate.id;
  });

  return locked;
}

function getRateLimitConfig() {
  return {
    daily: Number(process.env.MAX_DAILY_MESSAGES || DEFAULT_MAX_DAILY_MESSAGES),
    hourly: Number(process.env.MAX_HOURLY_MESSAGES || DEFAULT_MAX_HOURLY_MESSAGES)
  };
}

async function getRateLimitState(db) {
  if (shouldUsePostgresOnboarding()) {
    return postgresOutreachService.getRateLimitState();
  }

  const { daily, hourly } = getRateLimitConfig();
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [hourlyCount, dailyCount] = await Promise.all([
    countSentMessagesSince({ db, since: oneHourAgo }),
    countSentMessagesSince({ db, since: oneDayAgo })
  ]);

  if (Number.isFinite(hourly) && hourly > 0 && hourlyCount >= hourly) {
    return {
      limited: true,
      scope: 'hourly',
      count: hourlyCount,
      limit: hourly,
      waitMs: 60 * 60 * 1000
    };
  }

  if (Number.isFinite(daily) && daily > 0 && dailyCount >= daily) {
    return {
      limited: true,
      scope: 'daily',
      count: dailyCount,
      limit: daily,
      waitMs: 60 * 60 * 1000
    };
  }

  return {
    limited: false,
    hourlyCount,
    dailyCount,
    hourlyLimit: hourly,
    dailyLimit: daily
  };
}

async function processNextOnboardingJob({ dryRun = false } = {}) {
  if (shouldUsePostgresOnboarding()) {
    return postgresOutreachService.processNextOnboardingJob({ dryRun });
  }

  const db = getAutomationFirestore();
  await recoverStaleProcessingJobs(db);

  if (!dryRun) {
    const rateLimit = await getRateLimitState(db);
    if (rateLimit.limited) {
      return {
        processed: false,
        reason: 'rate_limited',
        ...rateLimit
      };
    }
  }

  const queueId = await lockNextQueueItem(db);
  if (!queueId) {
    return { processed: false, reason: 'no_pending_jobs' };
  }

  const result = await runQueueItem(queueId, { dryRun });
  return { processed: true, ...result };
}

async function runListingOutreach({
  listingId = null,
  to = null,
  dryRun = false,
  queueId = null
} = {}) {
  if (queueId) {
    return runQueueItem(queueId, { dryRun });
  }

  const listings = readScrapedListings();
  const { listing, phone } = selectListingForOutreach(listings, {
    listingId,
    overridePhone: to
  });

  if (!listing) {
    throw new Error('No eligible listing found for outreach.');
  }

  if (!phone) {
    throw new Error(`No valid phone number found for listing "${listing.title || listing.id}".`);
  }

  const title = listing.title || 'Property Listing';
  const claimUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/claim?token=dry-run-token`;
  const message = generateListingClaimMessage({ title, claimUrl });

  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      listingId: listing.id || null,
      to: phone,
      message
    };
  }

  const sendResult = await sendWhatsAppTextMessage({
    to: phone,
    text: message,
    previewUrl: Boolean(claimUrl),
    delay: randomDelayMs(1, 3)
  });

  return {
    success: true,
    dryRun: false,
    listingId: listing.id || null,
    to: phone,
    message,
    providerResponse: sendResult
  };
}

module.exports = {
  processNextOnboardingJob,
  runListingOutreach,
  runQueueItem,
  getRateLimitState
};
