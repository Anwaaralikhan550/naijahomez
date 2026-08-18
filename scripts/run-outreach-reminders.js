#!/usr/bin/env node

// Follow-up pass over outreach that was delivered but never acted on.
//
// Before this existed the pipeline was one-shot: 70% of claim tokens expired
// without the agent ever coming back. Each unclaimed advert now gets at most
// two nudges -- one ~3 days after the original message, a final one ~4 days
// after that -- and then we stop.
//
// Raw claim tokens are only ever stored hashed, so the original link cannot be
// rebuilt. Each reminder therefore mints a fresh token with its own TTL, which
// also lets the final reminder state a real expiry instead of a fake deadline.

const path = require('path');
const dotenv = require('dotenv');

const { describeSendWindow, evaluateSendWindow } = require('../src/lib/automation/send-window.cjs');
const { generateReminderMessage } = require('../src/lib/automation/message-template');
const { logEvent } = require('../src/lib/db/outreach-events-repository.cjs');
const { rowToListing } = require('../src/lib/db/listing-repository.cjs');

function loadEnv() {
  dotenv.config();
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });
}

loadEnv();

const { closePool, query } = require('../src/lib/db/postgres-client.cjs');
const { sendWhatsAppTextMessage } = require('../src/lib/whatsapp/evolution-client');
const {
  createBatchClaimToken,
  createClaimToken,
  isNumberSuppressed,
  randomDelayMs
} = require('../src/lib/automation/onboarding-queue-adapter.cjs');

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_BATCH_ADVERTS = 20;

// Reminder 1 fires 3 days after the original message, reminder 2 four days
// after reminder 1 -- i.e. day 3 and day 7 of the agent's journey.
const FIRST_REMINDER_AFTER_DAYS = Number(process.env.OUTREACH_REMINDER_FIRST_DAYS || 3);
const SECOND_REMINDER_AFTER_DAYS = Number(process.env.OUTREACH_REMINDER_SECOND_DAYS || 4);
const MAX_REMINDERS_PER_TARGET = 2;

const REMINDER_TTL_DAYS = Number(process.env.OUTREACH_REMINDER_TTL_DAYS || 10);
const FINAL_REMINDER_TTL_DAYS = Number(process.env.OUTREACH_REMINDER_FINAL_TTL_DAYS || 7);

function log(message) {
  console.log(`[${new Date().toISOString()}] [outreach-reminders] ${message}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

function parseArgs(argv) {
  const readNumber = (name, fallback) => {
    const prefix = `${name}=`;
    const inline = argv.find((arg) => arg.startsWith(prefix));
    if (!inline) return fallback;
    const parsed = Number(inline.slice(prefix.length));
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  return {
    dryRun: argv.includes('--dry-run'),
    ignoreSendWindow: argv.includes('--ignore-send-window'),
    maxMessages: readNumber('--max-messages', Number(process.env.OUTREACH_REMINDER_MAX_PER_RUN || 40)),
    delayMinSeconds: readNumber('--delay-min', Number(process.env.OUTREACH_REMINDER_DELAY_MIN_SECONDS || 8)),
    delayMaxSeconds: readNumber('--delay-max', Number(process.env.OUTREACH_REMINDER_DELAY_MAX_SECONDS || 20))
  };
}

// Reminders do not write onboarding_outreach_queue.sent_at, so they are
// invisible to the queue-based rate limiter. Count them from the event log
// instead so a big reminder run cannot silently blow past the hourly cap.
async function countRemindersSince(since) {
  const result = await query(
    `SELECT COUNT(*)::int AS count
     FROM outreach_funnel_events
     WHERE event_type = 'reminder_sent' AND created_at >= $1`,
    [since]
  );
  return result.rows[0]?.count || 0;
}

function gapDaysExpression() {
  return `CASE WHEN COALESCE(r.n, 0) = 0 THEN ${FIRST_REMINDER_AFTER_DAYS} ELSE ${SECOND_REMINDER_AFTER_DAYS} END`;
}

async function loadSingleTargets(limit) {
  const result = await query(
    `WITH reminders AS (
       SELECT claim_token_id, COUNT(*)::int AS n, MAX(created_at) AS last_at
       FROM outreach_funnel_events
       WHERE event_type = 'reminder_sent' AND claim_token_id IS NOT NULL
       GROUP BY claim_token_id
     )
     SELECT t.id           AS token_id,
            t.advert_id    AS advert_id,
            t.collection_name,
            q.id           AS queue_id,
            q.phone        AS phone,
            q.agent_name   AS agent_name,
            COALESCE(r.n, 0) AS reminder_count
     FROM advert_claim_tokens t
     JOIN onboarding_outreach_queue q ON q.claim_token_id = t.id
     LEFT JOIN reminders r ON r.claim_token_id = t.id
     WHERE t.claimed_at IS NULL
       AND q.status = 'sent'
       AND q.sent_at IS NOT NULL
       AND COALESCE(r.n, 0) < $1
       AND COALESCE(r.last_at, q.sent_at) <= NOW() - make_interval(days => ${gapDaysExpression()})
     ORDER BY q.sent_at ASC
     LIMIT $2`,
    [MAX_REMINDERS_PER_TARGET, limit]
  );
  return result.rows;
}

async function loadBatchTargets(limit) {
  const result = await query(
    `WITH reminders AS (
       SELECT batch_token_id, COUNT(*)::int AS n, MAX(created_at) AS last_at
       FROM outreach_funnel_events
       WHERE event_type = 'reminder_sent' AND batch_token_id IS NOT NULL
       GROUP BY batch_token_id
     )
     SELECT b.id          AS batch_id,
            b.phone       AS phone,
            b.raw_phone   AS raw_phone,
            b.advert_refs AS advert_refs,
            COALESCE(r.n, 0) AS reminder_count,
            (SELECT q.agent_name
               FROM onboarding_outreach_queue q
              WHERE q.batch_token_id = b.id AND q.agent_name IS NOT NULL
              LIMIT 1) AS agent_name
     FROM advert_claim_batches b
     LEFT JOIN reminders r ON r.batch_token_id = b.id
     WHERE b.claimed_at IS NULL
       AND b.sent_at IS NOT NULL
       AND COALESCE(r.n, 0) < $1
       AND COALESCE(r.last_at, b.sent_at) <= NOW() - make_interval(days => ${gapDaysExpression()})
     ORDER BY b.sent_at ASC
     LIMIT $2`,
    [MAX_REMINDERS_PER_TARGET, limit]
  );
  return result.rows;
}

async function fetchActiveUnclaimedListing(collectionName, advertId) {
  const result = await query(
    `SELECT *
     FROM public_listings
     WHERE collection_name = $1
       AND id = $2
       AND status = 'active'
       AND is_scraped = true
       AND (user_id IS NULL OR user_id = '')
     LIMIT 1`,
    [collectionName, advertId]
  );
  return result.rowCount ? rowToListing(result.rows[0]) : null;
}

function stageFor(reminderCount) {
  return Number(reminderCount) >= 1 ? 'final' : 'first';
}

function ttlDaysFor(stage) {
  return stage === 'final' ? FINAL_REMINDER_TTL_DAYS : REMINDER_TTL_DAYS;
}

async function buildSingleReminder(row) {
  const listing = await fetchActiveUnclaimedListing(row.collection_name, row.advert_id);
  if (!listing) return null;

  const stage = stageFor(row.reminder_count);
  const ttlDays = ttlDaysFor(stage);
  const token = await createClaimToken({
    collectionName: row.collection_name,
    advertId: row.advert_id,
    ttlMs: ttlDays * DAY_MS
  });

  const message = generateReminderMessage({
    stage,
    title: listing.title || 'Property Listing',
    location: listing.location || '',
    price: listing.price || listing.priceString || '',
    agentName: row.agent_name || listing.agentName || '',
    count: 1,
    manageUrl: token.manageUrl,
    claimUrl: token.claimUrl,
    expiresInDays: ttlDays
  });

  return {
    kind: 'single',
    phone: row.phone,
    message,
    stage,
    eventPayload: {
      queueId: row.queue_id,
      claimTokenId: row.token_id,
      advertId: row.advert_id,
      collectionName: row.collection_name,
      phone: row.phone,
      eventType: 'reminder_sent',
      metadata: { stage, reminderTokenId: token.id, ttlDays }
    }
  };
}

async function buildBatchReminder(row) {
  const advertRefs = Array.isArray(row.advert_refs) ? row.advert_refs : [];
  const liveItems = [];

  for (const ref of advertRefs.slice(0, MAX_BATCH_ADVERTS)) {
    if (!ref?.collectionName || !ref?.advertId) continue;
    const listing = await fetchActiveUnclaimedListing(ref.collectionName, ref.advertId);
    if (!listing) continue;
    liveItems.push({
      collectionName: ref.collectionName,
      advertId: ref.advertId,
      title: listing.title || ref.title || 'Property Listing',
      location: listing.location || ref.location || '',
      listing
    });
  }

  if (!liveItems.length) return null;

  const stage = stageFor(row.reminder_count);
  const ttlDays = ttlDaysFor(stage);

  // Only one advert survived -- a batch link for a single listing reads oddly,
  // so fall back to the single-advert flow.
  if (liveItems.length === 1) {
    const item = liveItems[0];
    const token = await createClaimToken({
      collectionName: item.collectionName,
      advertId: item.advertId,
      ttlMs: ttlDays * DAY_MS
    });

    return {
      kind: 'batch-collapsed',
      phone: row.raw_phone || row.phone,
      stage,
      message: generateReminderMessage({
        stage,
        title: item.title,
        location: item.location,
        price: item.listing.price || item.listing.priceString || '',
        agentName: row.agent_name || '',
        count: 1,
        manageUrl: token.manageUrl,
        claimUrl: token.claimUrl,
        expiresInDays: ttlDays
      }),
      eventPayload: {
        batchTokenId: row.batch_id,
        advertId: item.advertId,
        collectionName: item.collectionName,
        phone: row.phone,
        eventType: 'reminder_sent',
        metadata: { stage, reminderTokenId: token.id, ttlDays, collapsed: true }
      }
    };
  }

  const token = await createBatchClaimToken({
    phone: row.raw_phone || row.phone,
    queueItems: liveItems.map(({ collectionName, advertId, title, location }) => ({
      collectionName,
      advertId,
      title,
      location
    })),
    listings: liveItems.map((item) => item.listing),
    ttlMs: ttlDays * DAY_MS
  });

  return {
    kind: 'batch',
    phone: row.raw_phone || row.phone,
    stage,
    message: generateReminderMessage({
      stage,
      title: liveItems[0].title,
      location: liveItems[0].location,
      agentName: row.agent_name || '',
      count: liveItems.length,
      manageUrl: token.manageUrl,
      claimUrl: token.claimUrl,
      expiresInDays: ttlDays
    }),
    eventPayload: {
      batchTokenId: row.batch_id,
      phone: row.phone,
      eventType: 'reminder_sent',
      metadata: { stage, reminderTokenId: token.id, ttlDays, advertCount: liveItems.length }
    }
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  log(`Started. dryRun=${args.dryRun} maxMessages=${args.maxMessages}`);

  if (!args.dryRun && !args.ignoreSendWindow) {
    const window = evaluateSendWindow();
    if (!window.open) {
      log(`Outside send window ${describeSendWindow(window.window)} (local hour ${window.localHour}). Exiting.`);
      return;
    }
  }

  const hourlyLimit = Number(process.env.OUTREACH_REMINDER_MAX_HOURLY || 30);
  if (!args.dryRun && Number.isFinite(hourlyLimit) && hourlyLimit > 0) {
    const sentLastHour = await countRemindersSince(new Date(Date.now() - 60 * 60 * 1000));
    if (sentLastHour >= hourlyLimit) {
      log(`Hourly reminder cap reached (${sentLastHour}/${hourlyLimit}). Exiting.`);
      return;
    }
  }

  const [singleRows, batchRows] = await Promise.all([
    loadSingleTargets(args.maxMessages * 3),
    loadBatchTargets(args.maxMessages * 3)
  ]);
  log(`Candidates: single=${singleRows.length} batch=${batchRows.length}`);

  // Batches first: one message covering several adverts beats several messages.
  const ordered = [
    ...batchRows.map((row) => ({ type: 'batch', row })),
    ...singleRows.map((row) => ({ type: 'single', row }))
  ];

  const contactedPhones = new Set();
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const candidate of ordered) {
    if (sent >= args.maxMessages) {
      log(`Reached max messages for this run (${args.maxMessages}).`);
      break;
    }

    const phone = candidate.row.raw_phone || candidate.row.phone;
    if (!phone) {
      skipped += 1;
      continue;
    }

    // One reminder per number per run, whatever the source.
    if (contactedPhones.has(candidate.row.phone)) {
      skipped += 1;
      continue;
    }

    try {
      if (await isNumberSuppressed({ phone })) {
        skipped += 1;
        continue;
      }

      const reminder = candidate.type === 'batch'
        ? await buildBatchReminder(candidate.row)
        : await buildSingleReminder(candidate.row);

      if (!reminder) {
        skipped += 1;
        continue;
      }

      if (args.dryRun) {
        log(`DRY RUN would send ${reminder.kind}/${reminder.stage} to ${reminder.phone}`);
        console.log(reminder.message);
        contactedPhones.add(candidate.row.phone);
        sent += 1;
        continue;
      }

      await sendWhatsAppTextMessage({
        to: reminder.phone,
        text: reminder.message,
        previewUrl: true
      });

      await logEvent(reminder.eventPayload).catch(() => null);
      contactedPhones.add(candidate.row.phone);
      sent += 1;
      log(`Sent ${reminder.kind}/${reminder.stage} reminder to ${reminder.phone} (${sent}/${args.maxMessages})`);

      await sleep(randomDelayMs(args.delayMinSeconds, args.delayMaxSeconds));
    } catch (error) {
      failed += 1;
      log(`FAILED for ${phone}: ${error.message}`);
    }
  }

  log(`Finished. sent=${sent} skipped=${skipped} failed=${failed}`);
}

main()
  .catch((error) => {
    log(`FATAL: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool().catch(() => {});
  });
