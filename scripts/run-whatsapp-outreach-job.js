#!/usr/bin/env node

const path = require('path');
const dotenv = require('dotenv');
const { runListingOutreach } = require('../src/lib/automation/listing-outreach-service');

function loadEnv() {
  // Load default .env first (if present), then override with .env.local.
  dotenv.config();
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });
}

function parseArgs(argv) {
  const args = {
    listingId: null,
    to: null,
    queueId: null,
    dryRun: false
  };

  for (const arg of argv.slice(2)) {
    if (arg === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (arg.startsWith('--listingId=')) {
      args.listingId = arg.split('=')[1] || null;
      continue;
    }
    if (arg.startsWith('--to=')) {
      args.to = arg.split('=')[1] || null;
      continue;
    }
    if (arg.startsWith('--queueId=')) {
      args.queueId = arg.split('=')[1] || null;
      continue;
    }
  }

  return args;
}

async function main() {
  loadEnv();
  const args = parseArgs(process.argv);

  try {
    const result = await runListingOutreach(args);
    console.log('[outreach:whatsapp] Success');
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('[outreach:whatsapp] Failed');
    console.error(error.message);
    if (error.details) {
      console.error(JSON.stringify(error.details, null, 2));
    }
    process.exit(1);
  }
}

main();
