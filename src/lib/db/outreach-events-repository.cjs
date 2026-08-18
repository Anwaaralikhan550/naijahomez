const { query } = require('./postgres-client.cjs');

function toIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// Best-effort by design: a tracking-write failure must never block a real
// user action (deleting an ad, claiming an ad, sending a message), so this
// swallows its own errors instead of throwing into the caller.
async function logEvent({
  queueId = null,
  claimTokenId = null,
  batchTokenId = null,
  advertId = null,
  collectionName = null,
  phone = null,
  eventType,
  metadata = {}
}) {
  if (!eventType) return null;

  try {
    const result = await query(
      `INSERT INTO outreach_funnel_events (
         queue_id, claim_token_id, batch_token_id, advert_id, collection_name, phone, event_type, metadata
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       RETURNING id`,
      [queueId, claimTokenId, batchTokenId, advertId, collectionName, phone, eventType, JSON.stringify(metadata || {})]
    );
    return result.rows[0]?.id || null;
  } catch (error) {
    console.error('[outreach-events] logEvent failed:', eventType, error.message);
    return null;
  }
}

function rowToFunnelEntry(row) {
  return {
    queueId: row.queue_id,
    advertId: row.advert_id,
    collectionName: row.collection_name,
    phone: row.phone,
    agentName: row.agent_name,
    status: row.status,
    listingTitle: row.listing_title,
    listingLocation: row.listing_location,
    sentAt: toIso(row.sent_at),
    linkOpenedAt: toIso(row.link_opened_at),
    claimPageReachedAt: toIso(row.claim_page_reached_at),
    loginRequiredAt: toIso(row.login_required_at),
    adClaimedAt: toIso(row.ad_claimed_at),
    adDeletedAt: toIso(row.ad_deleted_at),
    claimedAt: toIso(row.claimed_at),
    claimedByUserId: row.claimed_by_user_id,
    newListingsSinceClaim: Number(row.new_listings_since_claim) || 0,
    createdAt: toIso(row.created_at)
  };
}

async function getAgentFunnel({ limit = 100, phone = null, status = null } = {}) {
  const params = [phone || null, status || null, Math.min(Number(limit) || 100, 250)];

  const result = await query(
    `SELECT
       oq.id AS queue_id,
       oq.advert_id,
       oq.collection_name,
       oq.phone,
       oq.agent_name,
       oq.status,
       oq.sent_at,
       oq.claimed_at,
       oq.claimed_by_user_id,
       oq.created_at,
       pl.title AS listing_title,
       pl.location AS listing_location,
       ev.link_opened_at,
       ev.claim_page_reached_at,
       ev.login_required_at,
       ev.ad_claimed_at,
       ev.ad_deleted_at,
       COALESCE(nl.new_listing_count, 0) AS new_listings_since_claim
     FROM onboarding_outreach_queue oq
     LEFT JOIN public_listings pl
       ON pl.collection_name = oq.collection_name AND pl.id = oq.advert_id
     LEFT JOIN LATERAL (
       SELECT
         MIN(e.created_at) FILTER (WHERE e.event_type = 'link_opened') AS link_opened_at,
         MIN(e.created_at) FILTER (WHERE e.event_type = 'claim_page_reached') AS claim_page_reached_at,
         MIN(e.created_at) FILTER (WHERE e.event_type = 'login_required') AS login_required_at,
         MIN(e.created_at) FILTER (WHERE e.event_type = 'ad_claimed') AS ad_claimed_at,
         MIN(e.created_at) FILTER (WHERE e.event_type = 'ad_deleted') AS ad_deleted_at
       FROM outreach_funnel_events e
       WHERE e.queue_id = oq.id
          OR (oq.claim_token_id IS NOT NULL AND e.claim_token_id = oq.claim_token_id)
          OR (oq.batch_token_id IS NOT NULL AND e.batch_token_id = oq.batch_token_id)
          OR (e.advert_id = oq.advert_id AND e.collection_name = oq.collection_name)
     ) ev ON TRUE
     LEFT JOIN LATERAL (
       SELECT COUNT(*) AS new_listing_count
       FROM public_listings np
       WHERE np.user_id = oq.claimed_by_user_id
         AND oq.claimed_by_user_id IS NOT NULL
         AND oq.claimed_at IS NOT NULL
         AND np.created_at > oq.claimed_at
         AND np.is_scraped = FALSE
         AND NOT (np.collection_name = oq.collection_name AND np.id = oq.advert_id)
     ) nl ON TRUE
     WHERE ($1::text IS NULL OR oq.phone ILIKE '%' || $1 || '%' OR oq.agent_name ILIKE '%' || $1 || '%')
       AND ($2::text IS NULL OR oq.status = $2)
     ORDER BY oq.created_at DESC
     LIMIT $3`,
    params
  );

  return result.rows.map(rowToFunnelEntry);
}

async function getOutreachFunnelSummary() {
  const result = await query(
    // The open check has to mirror the per-row matching in getAgentFunnel:
    // batch events carry batch_token_id rather than queue_id, so a plain
    // e.queue_id = oq.id join reports zero opens for every batch recipient.
    // EXISTS also avoids the row multiplication a LEFT JOIN caused when one
    // queue row had several link_opened events, which inflated every other
    // count in this query.
    `SELECT
       COUNT(*) FILTER (WHERE oq.sent_at IS NOT NULL AND oq.sent_at >= NOW() - INTERVAL '1 day') AS sent_today,
       COUNT(*) FILTER (WHERE oq.sent_at IS NOT NULL AND oq.sent_at >= NOW() - INTERVAL '7 days') AS sent_week,
       COUNT(*) FILTER (WHERE oq.sent_at IS NOT NULL) AS sent_total,
       COUNT(*) FILTER (WHERE oq.status = 'claimed') AS claimed_total,
       COUNT(*) FILTER (WHERE oq.status = 'deleted') AS deleted_total,
       COUNT(*) FILTER (WHERE EXISTS (
         SELECT 1 FROM outreach_funnel_events e
         WHERE e.event_type = 'link_opened'
           AND (e.queue_id = oq.id
                OR (oq.claim_token_id IS NOT NULL AND e.claim_token_id = oq.claim_token_id)
                OR (oq.batch_token_id IS NOT NULL AND e.batch_token_id = oq.batch_token_id))
       )) AS opened_total,
       COUNT(*) FILTER (WHERE EXISTS (
         SELECT 1 FROM outreach_funnel_events e
         WHERE e.event_type = 'reminder_sent'
           AND (e.queue_id = oq.id
                OR (oq.claim_token_id IS NOT NULL AND e.claim_token_id = oq.claim_token_id)
                OR (oq.batch_token_id IS NOT NULL AND e.batch_token_id = oq.batch_token_id))
       )) AS reminded_total
     FROM onboarding_outreach_queue oq`
  );

  const row = result.rows[0] || {};
  const sentTotal = Number(row.sent_total) || 0;
  const openedTotal = Number(row.opened_total) || 0;
  const claimedTotal = Number(row.claimed_total) || 0;
  const deletedTotal = Number(row.deleted_total) || 0;

  return {
    sentToday: Number(row.sent_today) || 0,
    sentWeek: Number(row.sent_week) || 0,
    sentTotal,
    openedTotal,
    claimedTotal,
    deletedTotal,
    remindedTotal: Number(row.reminded_total) || 0,
    openRatePct: sentTotal ? Number(((openedTotal / sentTotal) * 100).toFixed(1)) : 0,
    claimRatePct: sentTotal ? Number(((claimedTotal / sentTotal) * 100).toFixed(1)) : 0,
    deleteRatePct: sentTotal ? Number(((deletedTotal / sentTotal) * 100).toFixed(1)) : 0
  };
}

module.exports = {
  logEvent,
  getAgentFunnel,
  getOutreachFunnelSummary
};
