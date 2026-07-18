#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { loadEnvConfig } = require('@next/env');
const { getPool, closePool, isAppDbConfigured } = require('../src/lib/db/postgres-client.cjs');

const projectRoot = path.resolve(__dirname, '..');
const migrationsDir = path.join(projectRoot, 'db', 'migrations');

function usage() {
  console.log('Usage: node scripts/app-db-migrate.js');
  console.log('');
  console.log('Required env: APP_DATABASE_URL');
}

async function ensureMigrationsTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    usage();
    return;
  }

  loadEnvConfig(projectRoot);

  if (!isAppDbConfigured()) {
    throw new Error('APP_DATABASE_URL is required before running app DB migrations.');
  }

  const pool = getPool();
  await ensureMigrationsTable(pool);

  const files = fs.readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const alreadyApplied = await pool.query('SELECT id FROM app_migrations WHERE id = $1', [file]);
    if (alreadyApplied.rowCount > 0) {
      console.log(`[app-db] skip ${file}`);
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const client = await pool.connect();
    try {
      console.log(`[app-db] applying ${file}`);
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO app_migrations (id) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`[app-db] applied ${file}`);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  await closePool();
  console.log('[app-db] migrations complete');
}

main().catch(async (error) => {
  await closePool().catch(() => {});
  console.error('[app-db] migration failed:', error.message);
  process.exit(1);
});

