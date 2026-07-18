#!/usr/bin/env node
/**
 * One-time backfill: blogPosts / contentJobs rows sitting in the generic
 * app_documents JSONB shim -> the typed blog_posts / content_jobs tables.
 * Pure Postgres-to-Postgres, idempotent (ON CONFLICT DO UPDATE / re-insert
 * guarded by matching slug or source doc id kept in data.legacyDocId).
 *
 * Usage: node scripts/backfill-app-documents-to-content-tables.js [--dry-run]
 */

const path = require('path');
const { loadEnvConfig } = require('@next/env');
loadEnvConfig(path.resolve(__dirname, '..'));

const { query } = require('../src/lib/db/postgres-client.cjs');
const blogPostRepository = require('../src/lib/db/blog-post-repository.cjs');

const DRY_RUN = process.argv.includes('--dry-run');

function toDateOrNull(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function backfillBlogPosts() {
  const { rows } = await query(`SELECT doc_id, data FROM app_documents WHERE collection_path = 'blogPosts'`);
  console.log(`[backfill-content] blogPosts: ${rows.length} source rows`);

  let upserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const data = row.data || {};
    if (!data.title || !data.bodyMarkdown) {
      skipped += 1;
      continue;
    }

    const existing = await query(`SELECT id FROM blog_posts WHERE data->>'legacyDocId' = $1 LIMIT 1`, [row.doc_id]);
    if (existing.rows.length > 0) {
      skipped += 1;
      continue;
    }

    if (DRY_RUN) {
      upserted += 1;
      continue;
    }

    const {
      title, bodyMarkdown, summary, metaDescription, status,
      publishedAt, scheduledFor, createdAt, updatedAt,
      ...rest
    } = data;

    const slug = await blogPostRepository.ensureUniqueSlug(data.slug || title);
    const result = await query(
      `INSERT INTO blog_posts (slug, title, summary, body, status, meta_description, published_at, scheduled_at, created_at, updated_at, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, NOW()), COALESCE($10, NOW()), $11::jsonb)
       RETURNING id`,
      [
        slug, title, summary || null, bodyMarkdown, status || 'draft',
        metaDescription || null, toDateOrNull(publishedAt), toDateOrNull(scheduledFor),
        toDateOrNull(createdAt), toDateOrNull(updatedAt),
        JSON.stringify({ ...rest, legacyDocId: row.doc_id })
      ]
    );
    if (result.rows[0]) upserted += 1;
  }

  console.log(`[backfill-content] blogPosts: upserted=${upserted} skipped=${skipped}${DRY_RUN ? ' (dry-run)' : ''}`);
  return { upserted, skipped, total: rows.length };
}

async function backfillContentJobs() {
  const { rows } = await query(`SELECT doc_id, data FROM app_documents WHERE collection_path = 'contentJobs'`);
  console.log(`[backfill-content] contentJobs: ${rows.length} source rows`);

  let upserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const data = row.data || {};
    if (!data.topic) {
      skipped += 1;
      continue;
    }

    const existing = await query(`SELECT id FROM content_jobs WHERE data->>'legacyDocId' = $1 LIMIT 1`, [row.doc_id]);
    if (existing.rows.length > 0) {
      skipped += 1;
      continue;
    }

    if (DRY_RUN) {
      upserted += 1;
      continue;
    }

    const { status, attempts, nextRunAt, lastError, createdAt, updatedAt, ...rest } = data;

    const result = await query(
      `INSERT INTO content_jobs (job_type, status, attempts, next_run_at, last_error, created_at, updated_at, data)
       VALUES ('blog_generation', $1, $2, $3, $4, COALESCE($5, NOW()), COALESCE($6, NOW()), $7::jsonb)
       RETURNING id`,
      [
        status || 'pending', Number(attempts || 0), toDateOrNull(nextRunAt), lastError || null,
        toDateOrNull(createdAt), toDateOrNull(updatedAt),
        JSON.stringify({ ...rest, legacyDocId: row.doc_id })
      ]
    );
    if (result.rows[0]) upserted += 1;
  }

  console.log(`[backfill-content] contentJobs: upserted=${upserted} skipped=${skipped}${DRY_RUN ? ' (dry-run)' : ''}`);
  return { upserted, skipped, total: rows.length };
}

async function main() {
  console.log(`[backfill-content] starting${DRY_RUN ? ' (dry-run)' : ''}`);
  const summary = {
    blogPosts: await backfillBlogPosts(),
    contentJobs: await backfillContentJobs()
  };
  console.log('[backfill-content] done', JSON.stringify(summary));
  process.exit(0);
}

main().catch((error) => {
  console.error('[backfill-content] failed', error);
  process.exit(1);
});
