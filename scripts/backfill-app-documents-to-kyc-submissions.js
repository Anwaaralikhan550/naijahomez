#!/usr/bin/env node
/**
 * One-time backfill: kycSubmissions rows sitting in the generic
 * app_documents JSONB shim -> the typed kyc_submissions table.
 * Pure Postgres-to-Postgres, idempotent via a legacyDocId marker in data.
 *
 * Usage: node scripts/backfill-app-documents-to-kyc-submissions.js [--dry-run]
 */

const path = require('path');
const { loadEnvConfig } = require('@next/env');
loadEnvConfig(path.resolve(__dirname, '..'));

const { query } = require('../src/lib/db/postgres-client.cjs');

const DRY_RUN = process.argv.includes('--dry-run');

function toDateOrNull(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function main() {
  console.log(`[backfill-kyc] starting${DRY_RUN ? ' (dry-run)' : ''}`);

  const { rows } = await query(`SELECT doc_id, data FROM app_documents WHERE collection_path = 'kycSubmissions'`);
  console.log(`[backfill-kyc] source rows: ${rows.length}`);

  let upserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const data = row.data || {};
    if (!data.userId) {
      skipped += 1;
      continue;
    }

    const existing = await query(`SELECT id FROM kyc_submissions WHERE data->>'legacyDocId' = $1 LIMIT 1`, [row.doc_id]);
    if (existing.rows.length > 0) {
      skipped += 1;
      continue;
    }

    if (DRY_RUN) {
      upserted += 1;
      continue;
    }

    const {
      userId, status, documents = {}, rejectionReason, reviewedBy, reviewedAt,
      createdAt, updatedAt, ...rest
    } = data;
    const documentType = Object.keys(documents).sort().join(',') || null;

    await query(
      `INSERT INTO kyc_submissions (user_id, status, document_type, document_url, cac_document_url, rejection_reason, reviewed_by, reviewed_at, created_at, updated_at, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, NOW()), COALESCE($10, NOW()), $11::jsonb)`,
      [
        userId, status || 'pending', documentType, documents.id?.url || null, documents.cac?.url || null,
        rejectionReason || null, reviewedBy || null, toDateOrNull(reviewedAt),
        toDateOrNull(createdAt), toDateOrNull(updatedAt),
        JSON.stringify({ ...rest, userId, documents, legacyDocId: row.doc_id })
      ]
    );
    upserted += 1;
  }

  console.log(`[backfill-kyc] done upserted=${upserted} skipped=${skipped} total=${rows.length}${DRY_RUN ? ' (dry-run)' : ''}`);
  process.exit(0);
}

main().catch((error) => {
  console.error('[backfill-kyc] failed', error);
  process.exit(1);
});
