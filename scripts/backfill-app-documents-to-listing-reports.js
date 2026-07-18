#!/usr/bin/env node
/**
 * One-time backfill: listing_reports rows sitting in the generic
 * app_documents JSONB shim -> the typed listing_reports table.
 * Pure Postgres-to-Postgres, idempotent via a legacyDocId marker in data.
 *
 * Usage: node scripts/backfill-app-documents-to-listing-reports.js [--dry-run]
 */

const { query } = require('../src/lib/db/postgres-client.cjs');

const DRY_RUN = process.argv.includes('--dry-run');

function toDateOrNull(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function main() {
  console.log(`[backfill-listing-reports] starting${DRY_RUN ? ' (dry-run)' : ''}`);

  const { rows } = await query(`SELECT doc_id, data FROM app_documents WHERE collection_path = 'listing_reports'`);
  console.log(`[backfill-listing-reports] source rows: ${rows.length}`);

  let upserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const data = row.data || {};
    if (!data.listingId) {
      skipped += 1;
      continue;
    }

    const existing = await query(`SELECT id FROM listing_reports WHERE data->>'legacyDocId' = $1 LIMIT 1`, [row.doc_id]);
    if (existing.rows.length > 0) {
      skipped += 1;
      continue;
    }

    if (DRY_RUN) {
      upserted += 1;
      continue;
    }

    const {
      listingId, collectionName, reporterId, reason, description,
      status, resolvedBy, resolvedAt, createdAt, updatedAt,
      ...rest
    } = data;

    await query(
      `INSERT INTO listing_reports (listing_id, collection_name, reporter_user_id, reason, details, status, reviewed_by, reviewed_at, created_at, updated_at, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, NOW()), COALESCE($10, NOW()), $11::jsonb)`,
      [
        listingId, collectionName || '', reporterId || null, reason || null, description || null,
        status || 'pending', resolvedBy || null, toDateOrNull(resolvedAt),
        toDateOrNull(createdAt), toDateOrNull(updatedAt),
        JSON.stringify({ ...rest, legacyDocId: row.doc_id })
      ]
    );
    upserted += 1;
  }

  console.log(`[backfill-listing-reports] done upserted=${upserted} skipped=${skipped} total=${rows.length}${DRY_RUN ? ' (dry-run)' : ''}`);
  process.exit(0);
}

main().catch((error) => {
  console.error('[backfill-listing-reports] failed', error);
  process.exit(1);
});
