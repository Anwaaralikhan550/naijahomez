#!/usr/bin/env node
/**
 * One-time backfill: supportTickets (+ supportTicketMessages subcollection)
 * rows sitting in the generic app_documents JSONB shim -> the typed
 * support_tickets table (messages folded into data.messages). Pure
 * Postgres-to-Postgres, idempotent via a legacyDocId marker in data.
 *
 * Usage: node scripts/backfill-app-documents-to-support-tickets.js [--dry-run]
 */

const { query } = require('../src/lib/db/postgres-client.cjs');

const DRY_RUN = process.argv.includes('--dry-run');

function toDateOrNull(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function loadMessagesByTicket() {
  const { rows } = await query(
    `SELECT collection_path, doc_id, data FROM app_documents WHERE collection_path LIKE 'supportTickets/%/supportTicketMessages'`
  );

  const byTicket = new Map();
  for (const row of rows) {
    const ticketId = row.collection_path.split('/')[1];
    if (!byTicket.has(ticketId)) byTicket.set(ticketId, []);
    byTicket.get(ticketId).push({ ...row.data, id: row.doc_id });
  }
  return byTicket;
}

async function main() {
  console.log(`[backfill-support] starting${DRY_RUN ? ' (dry-run)' : ''}`);

  const messagesByTicket = await loadMessagesByTicket();
  const { rows } = await query(`SELECT doc_id, data FROM app_documents WHERE collection_path = 'supportTickets'`);
  console.log(`[backfill-support] supportTickets: ${rows.length} source rows, ${messagesByTicket.size} tickets with messages`);

  let upserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const data = row.data || {};
    if (!data.subject && !data.message) {
      skipped += 1;
      continue;
    }

    const existing = await query(`SELECT id FROM support_tickets WHERE data->>'legacyDocId' = $1 LIMIT 1`, [row.doc_id]);
    if (existing.rows.length > 0) {
      skipped += 1;
      continue;
    }

    if (DRY_RUN) {
      upserted += 1;
      continue;
    }

    const {
      email, phone, subject, message, status, priority, assignedTo,
      createdAt, updatedAt,
      ...rest
    } = data;

    const messages = (messagesByTicket.get(row.doc_id) || [])
      .sort((a, b) => Date.parse(a.createdAt || 0) - Date.parse(b.createdAt || 0));

    await query(
      `INSERT INTO support_tickets (email, phone, subject, message, status, priority, assigned_to, created_at, updated_at, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, NOW()), COALESCE($9, NOW()), $10::jsonb)`,
      [
        email || null, phone || null, subject || 'Support request', message || null,
        status || 'open', priority || 'normal', assignedTo || null,
        toDateOrNull(createdAt), toDateOrNull(updatedAt),
        JSON.stringify({ ...rest, messages, legacyDocId: row.doc_id })
      ]
    );
    upserted += 1;
  }

  console.log(`[backfill-support] done upserted=${upserted} skipped=${skipped} total=${rows.length}${DRY_RUN ? ' (dry-run)' : ''}`);
  process.exit(0);
}

main().catch((error) => {
  console.error('[backfill-support] failed', error);
  process.exit(1);
});
