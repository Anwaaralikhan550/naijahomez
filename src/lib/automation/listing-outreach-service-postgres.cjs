const { generateBatchListingClaimMessage, generateListingClaimMessage } = require('./message-template');
const { sendWhatsAppTextMessage } = require('../whatsapp/evolution-client');
const { getPool, query } = require('../db/postgres-client.cjs');
const { logEvent } = require('../db/outreach-events-repository.cjs');
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
  queueRowToItem,
  randomDelayMs,
  recoverStaleProcessingJobs,
  resolveAgentPhone,
  resolveListingLocation,
  toDate
} = require('./onboarding-queue-postgres.cjs');

const DEFAULT_MAX_DAILY_MESSAGES = 100;
const DEFAULT_MAX_HOURLY_MESSAGES = 15;
const MAX_BATCH_ADVERTS = 20;

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

async function loadQueueGroupForPhone(phone, lockedQueueId) {
  const normalizedPhone = normalizePhoneNumber(phone) || phone;
  const result = await query(
    `SELECT *
     FROM onboarding_outreach_queue
     WHERE phone = $1
       AND (
         (status = 'pending' AND (next_run_at IS NULL OR next_run_at <= NOW()))
         OR (status = 'processing' AND id = $2)
       )
     ORDER BY priority ASC, created_at ASC
     LIMIT $3`,
    [normalizedPhone, lockedQueueId, MAX_BATCH_ADVERTS]
  );

  let rows = result.rows;
  if (!rows.some((row) => row.id === lockedQueueId)) {
    const locked = await query('SELECT * FROM onboarding_outreach_queue WHERE id = $1 LIMIT 1', [lockedQueueId]);
    if (locked.rowCount > 0) rows = [locked.rows[0], ...rows].slice(0, MAX_BATCH_ADVERTS);
  }

  const items = rows.map(queueRowToItem);
  const listings = await Promise.all(items.map((item) =>
    fetchListing(null, item.collectionName, item.advertId).catch(() => null)
  ));

  return {
    rows,
    items,
    listings: listings.filter(Boolean)
  };
}

async function findRecentBatchForPhone(phone) {
  const normalizedPhone = normalizePhoneNumber(phone) || phone;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const result = await query(
    `SELECT *
     FROM advert_claim_batches
     WHERE phone = $1
       AND sent_at IS NOT NULL
       AND sent_at >= $2
       AND claimed_at IS NULL
       AND expires_at > NOW()
     ORDER BY sent_at DESC
     LIMIT 1`,
    [normalizedPhone, since]
  );

  if (result.rowCount === 0) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    data: {
      advertRefs: Array.isArray(row.advert_refs) ? row.advert_refs : []
    }
  };
}

async function markQueueGroupSuppressed(phone) {
  const normalizedPhone = normalizePhoneNumber(phone) || phone;
  const result = await query(
    `SELECT id
     FROM onboarding_outreach_queue
     WHERE phone = $1 AND status IN ('pending', 'processing')
     LIMIT 100`,
    [normalizedPhone]
  );

  await Promise.all(result.rows.map((row) => markQueueSuppressed(row.id, normalizedPhone)));
}

async function markQueueGroupBatched(rows, batchTokenId, reason) {
  if (!rows.length) return;
  const ids = rows.map((row) => row.id);
  await query(
    `UPDATE onboarding_outreach_queue
     SET status = 'batched',
         batch_token_id = $2,
         batched_at = NOW(),
         locked_at = NULL,
         last_error = $3,
         updated_at = NOW()
     WHERE id = ANY($1::text[])`,
    [ids, batchTokenId, reason || null]
  );
}

async function markQueueGroupSent(rows, { claimTokenId, batchTokenId, providerMessageId }) {
  if (!rows.length) return;
  const now = new Date();
  const firstId = rows[0].id;
  const otherIds = rows.slice(1).map((row) => row.id);

  await query(
    `UPDATE onboarding_outreach_queue
     SET status = 'sent',
         claim_token_id = $2,
         batch_token_id = $3,
         sent_at = $4,
         locked_at = NULL,
         last_error = NULL,
         provider_message_id = $5,
         updated_at = $4
     WHERE id = $1`,
    [firstId, claimTokenId || null, batchTokenId || null, now, providerMessageId || null]
  );

  if (otherIds.length) {
    await query(
      `UPDATE onboarding_outreach_queue
       SET status = 'batched',
           claim_token_id = NULL,
           batch_token_id = $2,
           sent_at = $3,
           locked_at = NULL,
           last_error = NULL,
           provider_message_id = NULL,
           updated_at = $3
       WHERE id = ANY($1::text[])`,
      [otherIds, batchTokenId || null, now]
    );
  }
}

async function runQueueItem(queueId, { dryRun = false } = {}) {
  const queueResult = await query('SELECT * FROM onboarding_outreach_queue WHERE id = $1 LIMIT 1', [queueId]);
  if (queueResult.rowCount === 0) {
    throw new Error(`Queue item "${queueId}" was not found.`);
  }

  const queueData = queueRowToItem(queueResult.rows[0]);
  const listing = await fetchListing(null, queueData.collectionName, queueData.advertId);
  if (!listing) {
    throw new Error(`Advert "${queueData.advertId}" was not found.`);
  }

  const phone = queueData.phone || resolveAgentPhone(listing);
  if (!phone) {
    throw new Error(`No valid phone number found for advert "${queueData.advertId}".`);
  }

  if (await isNumberSuppressed({ phone })) {
    if (!dryRun) await markQueueGroupSuppressed(phone);
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

  const group = await loadQueueGroupForPhone(phone, queueId);
  const recentBatch = !dryRun ? await findRecentBatchForPhone(phone) : null;

  if (recentBatch) {
    const batchItems = group.items.map((item) => ({
      collectionName: item.collectionName,
      advertId: item.advertId,
      title: item.title || '',
      location: item.location || ''
    }));
    const mergedRefs = mergeAdvertRefs(recentBatch.data.advertRefs || [], batchItems);

    await query(
      `UPDATE advert_claim_batches
       SET advert_refs = $2::jsonb,
           advert_count = $3,
           updated_at = NOW()
       WHERE id = $1`,
      [recentBatch.id, JSON.stringify(mergedRefs), mergedRefs.length]
    );

    await markQueueGroupBatched(group.rows, recentBatch.id, 'Existing message sent in the last 24 hours');

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
          phone,
          queueItems: group.items,
          listings: group.listings
        })
      : await createClaimToken({
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
    await query(
      `UPDATE onboarding_outreach_queue
       SET status = CASE WHEN status = 'processing' THEN 'pending' ELSE status END,
           locked_at = NULL,
           last_error = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [queueId]
    ).catch(() => null);

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

    const sentClaimTokenId = group.items.length > 1 ? null : claimToken.id;
    const sentBatchTokenId = group.items.length > 1 ? claimToken.id : null;

    await markQueueGroupSent(group.rows, {
      claimTokenId: sentClaimTokenId,
      batchTokenId: sentBatchTokenId,
      providerMessageId
    });

    await Promise.all(
      group.rows.map((row) => logEvent({
        queueId: row.id,
        claimTokenId: sentClaimTokenId,
        batchTokenId: sentBatchTokenId,
        advertId: row.advert_id,
        collectionName: row.collection_name,
        phone,
        eventType: 'sent',
        metadata: { providerMessageId }
      }))
    );

    if (group.items.length > 1) {
      await query(
        `UPDATE advert_claim_batches
         SET sent_at = NOW(),
             provider_message_id = $2,
             updated_at = NOW()
         WHERE id = $1`,
        [claimToken.id, providerMessageId]
      );
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
    await markQueueFailed(queueId, queueData, error);
    throw error;
  }
}

async function lockNextQueueItem() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT id
       FROM onboarding_outreach_queue
       WHERE status = 'pending'
         AND (next_run_at IS NULL OR next_run_at <= NOW())
       ORDER BY priority ASC, created_at ASC
       FOR UPDATE SKIP LOCKED
       LIMIT 1`
    );

    if (result.rowCount === 0) {
      await client.query('COMMIT');
      return null;
    }

    const queueId = result.rows[0].id;
    await client.query(
      `UPDATE onboarding_outreach_queue
       SET status = 'processing',
           locked_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [queueId]
    );
    await client.query('COMMIT');
    return queueId;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

function getRateLimitConfig() {
  return {
    daily: Number(process.env.MAX_DAILY_MESSAGES || DEFAULT_MAX_DAILY_MESSAGES),
    hourly: Number(process.env.MAX_HOURLY_MESSAGES || DEFAULT_MAX_HOURLY_MESSAGES)
  };
}

async function getRateLimitState() {
  const { daily, hourly } = getRateLimitConfig();
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [hourlyCount, dailyCount] = await Promise.all([
    countSentMessagesSince({ since: oneHourAgo }),
    countSentMessagesSince({ since: oneDayAgo })
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
  await recoverStaleProcessingJobs();

  if (!dryRun) {
    const rateLimit = await getRateLimitState();
    if (rateLimit.limited) {
      return {
        processed: false,
        reason: 'rate_limited',
        ...rateLimit
      };
    }
  }

  const queueId = await lockNextQueueItem();
  if (!queueId) {
    return { processed: false, reason: 'no_pending_jobs' };
  }

  const result = await runQueueItem(queueId, { dryRun });
  return { processed: true, ...result };
}

module.exports = {
  getRateLimitState,
  processNextOnboardingJob,
  runQueueItem,
  lockNextQueueItem
};
