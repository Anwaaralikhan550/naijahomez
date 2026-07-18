#!/usr/bin/env node

const path = require('path');
const dotenv = require('dotenv');
const {
  processNextContentJob,
  processNextSocialShare,
  refreshMarketTrends
} = require('../src/lib/content/content-engine');

function loadEnv() {
  dotenv.config();
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv) {
  return {
    once: argv.includes('--once'),
    dryRun: argv.includes('--dry-run'),
    refreshTrends: argv.includes('--refresh-trends'),
    idleDelayMs: 30000
  };
}

async function main() {
  loadEnv();
  const args = parseArgs(process.argv);
  console.log('[content-worker] Started');

  if (args.refreshTrends) {
    try {
      const result = await refreshMarketTrends({ dryRun: args.dryRun });
      console.log('[content-worker] Market trends refreshed');
      console.log(JSON.stringify({
        dryRun: result.dryRun,
        locations: result.trend?.locations?.length || 0,
        totalActiveListings: result.trend?.totals?.totalActiveListings || 0
      }, null, 2));
      if (args.once) return;
    } catch (error) {
      console.error('[content-worker] Market trends refresh failed:', error.message);
      if (args.once) {
        process.exitCode = 1;
        return;
      }
    }
  }

  do {
    try {
      const contentResult = await processNextContentJob({ dryRun: args.dryRun });
      if (contentResult.processed) {
        console.log('[content-worker] Content result');
        console.log(JSON.stringify(contentResult, null, 2));
      }

      const socialResult = await processNextSocialShare({ dryRun: args.dryRun });
      if (socialResult.processed) {
        console.log('[content-worker] Social result');
        console.log(JSON.stringify(socialResult, null, 2));
      }

      if (args.once) {
        if (!contentResult.processed && !socialResult.processed) {
          console.log('[content-worker] No due content or social jobs');
        }
        break;
      }

      await sleep(contentResult.processed || socialResult.processed ? 5000 : args.idleDelayMs);
    } catch (error) {
      console.error('[content-worker] Failed:', error.message);
      if (args.once) {
        process.exitCode = 1;
        break;
      }
      await sleep(args.idleDelayMs);
    }
  } while (!args.once);
}

main();
