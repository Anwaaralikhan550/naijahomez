const { query } = require('./postgres-client.cjs');

const MAX_JOB_ATTEMPTS = 3;
const STALE_PROCESSING_MS = 10 * 60 * 1000;

function toIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function rowToJob(row) {
  if (!row) return null;
  const data = row.data || {};
  return {
    id: row.id,
    jobType: row.job_type,
    status: row.status,
    attempts: row.attempts,
    lastError: row.last_error,
    ...data,
    nextRunAt: toIso(row.next_run_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

async function createContentJob({ topic, promptType = 'property_guide', nextRunAt = null, sourceReferences = [], createdBy = 'admin' }) {
  const result = await query(
    `INSERT INTO content_jobs (job_type, status, attempts, next_run_at, data)
     VALUES ('blog_generation', 'pending', 0, $1, $2::jsonb)
     RETURNING *`,
    [nextRunAt || new Date(), JSON.stringify({ topic, promptType, sourceReferences, createdBy })]
  );
  return rowToJob(result.rows[0]);
}

async function listRecentContentJobs({ limit = 25 } = {}) {
  const result = await query(
    `SELECT * FROM content_jobs ORDER BY created_at DESC LIMIT $1`,
    [Math.min(Math.max(Number(limit) || 25, 1), 200)]
  );
  return result.rows.map(rowToJob);
}

// Atomically claim the next due job (pending & due, or stuck in processing past the
// stale threshold) using FOR UPDATE SKIP LOCKED -- the standard Postgres job-queue
// pattern, replacing the Firestore-transaction-based claim this used to require.
async function lockNextContentJob() {
  const result = await query(
    `WITH candidate AS (
       SELECT id FROM content_jobs
       WHERE attempts < $1
         AND (
           (status = 'pending' AND (next_run_at IS NULL OR next_run_at <= NOW()))
           OR (status = 'processing' AND updated_at <= NOW() - ($2 || ' milliseconds')::interval)
         )
       ORDER BY next_run_at NULLS FIRST, created_at
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     UPDATE content_jobs
     SET status = 'processing', attempts = attempts + 1, updated_at = NOW()
     WHERE id IN (SELECT id FROM candidate)
     RETURNING *`,
    [MAX_JOB_ATTEMPTS, STALE_PROCESSING_MS]
  );
  return rowToJob(result.rows[0]);
}

async function markContentJobCompleted(jobId, { blogPostId } = {}) {
  await query(
    `UPDATE content_jobs
     SET status = 'completed', last_error = NULL, updated_at = NOW(),
         data = data || $2::jsonb
     WHERE id = $1`,
    [jobId, JSON.stringify({ blogPostId, completedAt: new Date().toISOString() })]
  );
}

async function markContentJobFailed(jobId, { lastError, exhausted, nextRunAt } = {}) {
  await query(
    `UPDATE content_jobs
     SET status = $2, last_error = $3, next_run_at = $4, updated_at = NOW(),
         data = data || $5::jsonb
     WHERE id = $1`,
    [
      jobId,
      exhausted ? 'failed' : 'pending',
      lastError || null,
      nextRunAt || null,
      JSON.stringify(exhausted ? { failedAt: new Date().toISOString() } : {})
    ]
  );
}

async function resetContentJobToPending(jobId) {
  await query(
    `UPDATE content_jobs SET status = 'pending', updated_at = NOW() WHERE id = $1`,
    [jobId]
  );
}

module.exports = {
  createContentJob,
  listRecentContentJobs,
  lockNextContentJob,
  markContentJobCompleted,
  markContentJobFailed,
  resetContentJobToPending,
  rowToJob
};
