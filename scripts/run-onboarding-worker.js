#!/usr/bin/env node

const path = require('path');
const dotenv = require('dotenv');
const { processNextOnboardingJob } = require('../src/lib/automation/listing-outreach-service');
const { randomDelayMs } = require('../src/lib/automation/onboarding-queue-adapter.cjs');

function loadEnv() {
  dotenv.config();
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isQuotaExceededError(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === 8 || message.includes('resource_exhausted') || message.includes('quota exceeded');
}

function parseArgs(argv) {
  const readNumberArg = (name, fallback) => {
    const prefix = `${name}=`;
    const inline = argv.find((arg) => arg.startsWith(prefix));
    if (inline) {
      const parsed = Number(inline.slice(prefix.length));
      return Number.isFinite(parsed) ? parsed : fallback;
    }

    const index = argv.indexOf(name);
    if (index !== -1 && argv[index + 1]) {
      const parsed = Number(argv[index + 1]);
      return Number.isFinite(parsed) ? parsed : fallback;
    }

    return fallback;
  };

  return {
    once: argv.includes('--once'),
    drain: argv.includes('--drain'),
    dryRun: argv.includes('--dry-run'),
    idleDelayMs: readNumberArg('--idle-delay-ms', 15000),
    delayMinSeconds: readNumberArg('--delay-min', Number(process.env.ONBOARDING_DELAY_MIN_SECONDS || 30)),
    delayMaxSeconds: readNumberArg('--delay-max', Number(process.env.ONBOARDING_DELAY_MAX_SECONDS || 60)),
    errorDelayMs: readNumberArg('--error-delay-ms', Number(process.env.ONBOARDING_ERROR_DELAY_MS || 15 * 60 * 1000)),
    quotaDelayMs: readNumberArg('--quota-delay-ms', Number(process.env.ONBOARDING_QUOTA_DELAY_MS || 60 * 60 * 1000)),
    maxJobs: readNumberArg('--max-jobs', Number(process.env.ONBOARDING_MAX_JOBS || 0)),
    emptyGraceMs: readNumberArg('--empty-grace-ms', 0)
  };
}

async function main() {
  loadEnv();
  const args = parseArgs(process.argv);
  let processedCount = 0;
  let emptyGraceUsed = false;

  console.log('[onboarding-worker] Started');
  console.log(JSON.stringify({
    once: args.once,
    drain: args.drain,
    dryRun: args.dryRun,
    delayMinSeconds: args.delayMinSeconds,
    delayMaxSeconds: args.delayMaxSeconds,
    maxJobs: args.maxJobs || null
  }, null, 2));

  do {
    try {
      const result = await processNextOnboardingJob({ dryRun: args.dryRun });
      if (result.processed) {
        emptyGraceUsed = false;
        processedCount += 1;
        console.log('[onboarding-worker] Processed job');
        console.log(JSON.stringify({
          queueId: result.queueId,
          listingId: result.listingId,
          to: result.to,
          dryRun: result.dryRun,
          suppressed: Boolean(result.suppressed),
          batched: Boolean(result.batched),
          batchedCount: result.batchedCount || 1,
          batchTokenId: result.batchTokenId || null,
          sent: Boolean(result.sent)
        }, null, 2));
        if (args.once) {
          break;
        }
        if (args.maxJobs > 0 && processedCount >= args.maxJobs) {
          console.log(`[onboarding-worker] Max jobs reached (${processedCount}/${args.maxJobs})`);
          break;
        }
        if (result.sent) {
          await sleep(randomDelayMs(args.delayMinSeconds, args.delayMaxSeconds));
        }
      } else {
        if (args.once || args.drain) {
          if (
            args.drain &&
            args.emptyGraceMs > 0 &&
            !emptyGraceUsed &&
            result.reason === 'no_pending_jobs'
          ) {
            emptyGraceUsed = true;
            console.log(`[onboarding-worker] No due job yet. Waiting grace period ${args.emptyGraceMs}ms`);
            await sleep(args.emptyGraceMs);
            continue;
          }
          console.log(`[onboarding-worker] No job processed (${result.reason || 'unknown'})`);
          break;
        }
        if (result.reason === 'rate_limited') {
          console.log('[onboarding-worker] Rate limit reached');
          console.log(JSON.stringify({
            scope: result.scope,
            count: result.count,
            limit: result.limit,
            waitMs: result.waitMs
          }, null, 2));
        }
        await sleep(result.waitMs || args.idleDelayMs);
      }
    } catch (error) {
      console.error('[onboarding-worker] Job failed:', error.message);
      if (error.details) {
        console.error(JSON.stringify(error.details, null, 2));
      }
      const quotaExceeded = isQuotaExceededError(error);
      if (quotaExceeded) {
        console.error(`[onboarding-worker] Firestore quota exceeded. Pausing for ${args.quotaDelayMs}ms to avoid hammering the database.`);
      }
      await sleep(args.once ? 0 : (quotaExceeded ? args.quotaDelayMs : args.errorDelayMs));
      if (args.once) process.exitCode = 1;
    }
  } while (!args.once);

  console.log(`[onboarding-worker] Finished. processed=${processedCount}`);
}

main();
