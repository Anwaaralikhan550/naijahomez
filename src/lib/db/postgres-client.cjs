const { Pool } = require('pg');

let pool = null;

function normalizeText(value) {
  return String(value || '').trim();
}

function getDatabaseUrl() {
  return normalizeText(process.env.APP_DATABASE_URL || process.env.NIJAHOMZS_DATABASE_URL || '');
}

function isAppDbConfigured() {
  return Boolean(getDatabaseUrl());
}

function isAppDbEnabled() {
  const provider = normalizeText(process.env.LISTINGS_DB_PROVIDER || '').toLowerCase();
  if (provider === 'firestore') return false;
  if (provider === 'postgres' || provider === 'postgresql') return isAppDbConfigured();
  return isAppDbConfigured();
}

function getPool() {
  const connectionString = getDatabaseUrl();
  if (!connectionString) {
    throw new Error('APP_DATABASE_URL is not configured.');
  }

  if (!pool) {
    pool = new Pool({
      connectionString,
      max: Number(process.env.APP_DB_POOL_MAX || 5),
      idleTimeoutMillis: Number(process.env.APP_DB_IDLE_TIMEOUT_MS || 10000),
      connectionTimeoutMillis: Number(process.env.APP_DB_CONNECT_TIMEOUT_MS || 3000),
      query_timeout: Number(process.env.APP_DB_QUERY_TIMEOUT_MS || 10000),
      statement_timeout: Number(process.env.APP_DB_STATEMENT_TIMEOUT_MS || 10000),
      application_name: process.env.APP_DB_APPLICATION_NAME || 'nijahomzs-web'
    });

    pool.on('error', (error) => {
      console.error('[app-db] idle client error:', error?.message || error);
    });
  }

  return pool;
}

async function query(text, params = []) {
  if (!isAppDbEnabled()) {
    const error = new Error('App PostgreSQL database is not enabled.');
    error.code = 'APP_DB_DISABLED';
    throw error;
  }

  return getPool().query(text, params);
}

async function closePool() {
  if (!pool) return;
  const current = pool;
  pool = null;
  await current.end();
}

module.exports = {
  closePool,
  getDatabaseUrl,
  getPool,
  isAppDbConfigured,
  isAppDbEnabled,
  query
};

