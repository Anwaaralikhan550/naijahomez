#!/usr/bin/env node

const path = require('path');
const dotenv = require('dotenv');
const { generateWeeklyReports } = require('../src/lib/advertising/ad-engine');

function loadEnv() {
  dotenv.config();
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv) {
  const intervalArg = argv.find((arg) => arg.startsWith('--interval-ms='));
  return {
    once: argv.includes('--once'),
    dryRun: argv.includes('--dry-run'),
    intervalMs: intervalArg ? Math.max(60000, Number(intervalArg.split('=')[1]) || 0) : 6 * 60 * 60 * 1000
  };
}

async function runOnce({ dryRun }) {
  if (dryRun) {
    console.log('[analytics-worker] Dry run: report generation skipped');
    return { dryRun: true };
  }
  return generateWeeklyReports();
}

async function main() {
  loadEnv();
  const args = parseArgs(process.argv);
  console.log('[analytics-worker] Started');

  do {
    try {
      const result = await runOnce(args);
      console.log('[analytics-worker] Report result');
      console.log(JSON.stringify(result, null, 2));
      if (args.once) break;
      await sleep(args.intervalMs);
    } catch (error) {
      console.error('[analytics-worker] Failed:', error.message);
      if (args.once) {
        process.exitCode = 1;
        break;
      }
      await sleep(Math.min(args.intervalMs, 5 * 60 * 1000));
    }
  } while (!args.once);
}

main();
