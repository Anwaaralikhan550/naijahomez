#!/usr/bin/env node

const path = require('path');
const { loadEnvConfig } = require('@next/env');
const { closePool, isAppDbConfigured, query } = require('../src/lib/db/postgres-client.cjs');
const { getHealthSummary } = require('../src/lib/db/listing-repository.cjs');

const projectRoot = path.resolve(__dirname, '..');

async function main() {
  loadEnvConfig(projectRoot);

  if (!isAppDbConfigured()) {
    console.log(JSON.stringify({
      success: false,
      error: 'APP_DATABASE_URL is not configured.'
    }, null, 2));
    process.exitCode = 1;
    return;
  }

  const ping = await query(`
    SELECT
      current_database() AS database,
      current_user AS user,
      NOW() AS checked_at
  `);
  const summary = await getHealthSummary();

  console.log(JSON.stringify({
    success: true,
    database: ping.rows[0],
    summary
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    success: false,
    error: error.message
  }, null, 2));
  process.exitCode = 1;
}).finally(async () => {
  await closePool().catch(() => {});
});

