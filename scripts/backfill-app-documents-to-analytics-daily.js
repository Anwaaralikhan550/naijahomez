#!/usr/bin/env node
/**
 * One-time backfill: journeyMetricDaily / heatmapMetricDaily rows currently
 * sitting in the generic app_documents JSONB shim -> the typed analytics_daily
 * table. Pure Postgres-to-Postgres (source is already Postgres), so no
 * Firestore rate limiting is needed. Idempotent via ON CONFLICT DO UPDATE.
 *
 * Usage: node scripts/backfill-app-documents-to-analytics-daily.js [--dry-run]
 */

const path = require('path');
const { loadEnvConfig } = require('@next/env');
loadEnvConfig(path.resolve(__dirname, '..'));

const { query } = require('../src/lib/db/postgres-client.cjs');

const SOURCE_COLLECTIONS = {
  journeyMetricDaily: 'journey_step',
  heatmapMetricDaily: 'heatmap_click'
};

const DRY_RUN = process.argv.includes('--dry-run');

function splitDocId(docId) {
  const idx = docId.indexOf('__');
  if (idx === -1) return { dayPrefix: docId, rest: '' };
  return { dayPrefix: docId.slice(0, idx), rest: docId.slice(idx + 2) };
}

async function backfillCollection(collectionPath, metricName) {
  const { rows } = await query(
    `SELECT doc_id, data FROM app_documents WHERE collection_path = $1`,
    [collectionPath]
  );

  console.log(`[backfill-analytics] ${collectionPath}: ${rows.length} source rows`);

  let upserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const data = row.data || {};
    const day = data.dateKey || splitDocId(row.doc_id).dayPrefix;
    const count = Number(data.count || 0);

    if (!day || !Number.isFinite(count)) {
      skipped += 1;
      continue;
    }

    const { rest } = splitDocId(row.doc_id);
    const dimensionKey = rest || row.doc_id;

    const restData = { ...data };
    delete restData.dateKey;
    delete restData.count;
    delete restData.updatedAt;

    if (DRY_RUN) {
      upserted += 1;
      continue;
    }

    await query(
      `INSERT INTO analytics_daily (day, metric_name, dimension_key, count, data, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
       ON CONFLICT (day, metric_name, dimension_key)
       DO UPDATE SET
         count = GREATEST(analytics_daily.count, EXCLUDED.count),
         data = EXCLUDED.data,
         updated_at = NOW()`,
      [day, metricName, dimensionKey, count, JSON.stringify(restData)]
    );
    upserted += 1;
  }

  console.log(`[backfill-analytics] ${collectionPath}: upserted=${upserted} skipped=${skipped}${DRY_RUN ? ' (dry-run)' : ''}`);
  return { upserted, skipped, total: rows.length };
}

async function main() {
  console.log(`[backfill-analytics] starting${DRY_RUN ? ' (dry-run)' : ''}`);
  const summary = {};
  for (const [collectionPath, metricName] of Object.entries(SOURCE_COLLECTIONS)) {
    summary[collectionPath] = await backfillCollection(collectionPath, metricName);
  }
  console.log('[backfill-analytics] done', JSON.stringify(summary));
  process.exit(0);
}

main().catch((error) => {
  console.error('[backfill-analytics] failed', error);
  process.exit(1);
});
