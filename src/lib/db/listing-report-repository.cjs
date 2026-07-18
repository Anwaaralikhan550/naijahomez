const { query } = require('./postgres-client.cjs');

function toIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function rowToReport(row) {
  if (!row) return null;
  const data = row.data || {};
  return {
    id: row.id,
    listingId: row.listing_id,
    collectionName: row.collection_name,
    reporterId: row.reporter_user_id,
    reason: row.reason,
    description: row.details,
    status: row.status,
    resolvedBy: row.reviewed_by,
    ...data,
    resolvedAt: toIso(row.reviewed_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

async function createListingReport(report) {
  const {
    listingId, collectionName = '', reporterId = null, reason = null, description = null,
    status = 'pending', ...rest
  } = report;

  const result = await query(
    `INSERT INTO listing_reports (listing_id, collection_name, reporter_user_id, reason, details, status, data)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     RETURNING *`,
    [listingId, collectionName || '', reporterId, reason, description, status, JSON.stringify(rest)]
  );
  return rowToReport(result.rows[0]);
}

async function findDuplicateReport({ reporterId, listingId, reason, sinceDate }) {
  const result = await query(
    `SELECT * FROM listing_reports
     WHERE reporter_user_id = $1 AND listing_id = $2 AND reason = $3 AND created_at >= $4
     ORDER BY created_at DESC
     LIMIT 1`,
    [reporterId, listingId, reason, sinceDate]
  );
  return rowToReport(result.rows[0]);
}

async function getReportById(id) {
  const result = await query(`SELECT * FROM listing_reports WHERE id = $1`, [id]);
  return rowToReport(result.rows[0]);
}

async function listReportsByStatus({ status = 'pending', limit = 100 } = {}) {
  const result = await query(
    `SELECT * FROM listing_reports WHERE status = $1 ORDER BY created_at DESC LIMIT $2`,
    [status, Math.min(Math.max(Number(limit) || 100, 1), 200)]
  );
  return result.rows.map(rowToReport);
}

async function resolveReport(id, { resolutionAction, resolvedBy, ...extra } = {}) {
  const result = await query(
    `UPDATE listing_reports
     SET status = 'resolved', reviewed_by = $2, reviewed_at = NOW(), updated_at = NOW(),
         data = data || $3::jsonb
     WHERE id = $1
     RETURNING *`,
    [id, resolvedBy || null, JSON.stringify({ resolutionAction, ...extra })]
  );
  return rowToReport(result.rows[0]);
}

module.exports = {
  createListingReport,
  findDuplicateReport,
  getReportById,
  listReportsByStatus,
  resolveReport,
  rowToReport
};
