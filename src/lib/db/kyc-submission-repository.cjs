const { query } = require('./postgres-client.cjs');

const PENDING_LIKE_STATUSES = ['pending', 'rejected', 'unverified'];

function toIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function rowToSubmission(row) {
  if (!row) return null;
  const data = row.data || {};
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    documents: data.documents || {},
    phoneVerification: data.phoneVerification || null,
    rejectionReason: row.rejection_reason,
    reviewedBy: row.reviewed_by,
    userEmail: data.userEmail || null,
    ...data,
    reviewedAt: toIso(row.reviewed_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

async function getLatestSubmission(userId) {
  const result = await query(
    `SELECT * FROM kyc_submissions WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1`,
    [userId]
  );
  return rowToSubmission(result.rows[0]);
}

async function getSubmissionById(id) {
  const result = await query(`SELECT * FROM kyc_submissions WHERE id = $1`, [id]);
  return rowToSubmission(result.rows[0]);
}

async function listPendingSubmissions() {
  const result = await query(`SELECT * FROM kyc_submissions WHERE status = 'pending' ORDER BY updated_at DESC`);
  return result.rows.map(rowToSubmission);
}

// Upserts the caller's in-progress submission: merges into the existing
// pending/rejected/unverified submission if one exists, otherwise creates
// a new row. Mirrors the old Firestore "reuse doc while not yet approved" logic.
async function upsertPendingSubmission({ userId, userEmail, documents }) {
  const existing = await getLatestSubmission(userId);
  const reuseExisting = existing && PENDING_LIKE_STATUSES.includes(String(existing.status || '').toLowerCase());
  const mergedDocuments = { ...(reuseExisting ? existing.documents : {}), ...documents };
  const documentType = Object.keys(mergedDocuments).sort().join(',') || null;

  if (reuseExisting) {
    const result = await query(
      `UPDATE kyc_submissions
       SET status = 'pending', document_type = $2, document_url = $3, cac_document_url = $4,
           rejection_reason = NULL, reviewed_at = NULL, reviewed_by = NULL, updated_at = NOW(),
           data = data || $5::jsonb
       WHERE id = $1
       RETURNING *`,
      [
        existing.id, documentType, mergedDocuments.id?.url || null, mergedDocuments.cac?.url || null,
        JSON.stringify({ userId, userEmail, documents: mergedDocuments })
      ]
    );
    return rowToSubmission(result.rows[0]);
  }

  const result = await query(
    `INSERT INTO kyc_submissions (user_id, status, document_type, document_url, cac_document_url, data)
     VALUES ($1, 'pending', $2, $3, $4, $5::jsonb)
     RETURNING *`,
    [
      userId, documentType, mergedDocuments.id?.url || null, mergedDocuments.cac?.url || null,
      JSON.stringify({ userId, userEmail, documents: mergedDocuments })
    ]
  );
  return rowToSubmission(result.rows[0]);
}

async function resolveSubmission(id, { status, reviewedBy, rejectionReason = null } = {}) {
  const result = await query(
    `UPDATE kyc_submissions
     SET status = $2, reviewed_by = $3, reviewed_at = NOW(), rejection_reason = $4, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, status, reviewedBy || null, rejectionReason]
  );
  return rowToSubmission(result.rows[0]);
}

module.exports = {
  getLatestSubmission,
  getSubmissionById,
  listPendingSubmissions,
  upsertPendingSubmission,
  resolveSubmission,
  rowToSubmission
};
