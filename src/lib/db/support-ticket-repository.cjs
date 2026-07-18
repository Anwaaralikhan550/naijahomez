const { query } = require('./postgres-client.cjs');

function toIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function rowToTicket(row) {
  if (!row) return null;
  const data = row.data || {};
  const { messages, ...restData } = data;
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    subject: row.subject,
    message: row.message,
    status: row.status,
    priority: row.priority,
    assignedTo: row.assigned_to,
    ...restData,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    lastMessageAt: toIso(restData.lastMessageAt),
    escalatedAt: toIso(restData.escalatedAt),
    resolvedAt: toIso(restData.resolvedAt)
  };
}

function rowToTicketWithMessages(row) {
  const ticket = rowToTicket(row);
  if (!ticket) return null;
  const messages = (row.data?.messages || []).map((message) => ({
    ...message,
    createdAt: toIso(message.createdAt)
  }));
  return { ...ticket, messages };
}

async function createSupportTicket(ticket) {
  const {
    email = null, phone = null, subject, message = null,
    status = 'open', priority = 'normal', assignedTo = null,
    firstMessage = null,
    ...rest
  } = ticket;

  const data = { ...rest };
  if (firstMessage) {
    data.messages = [firstMessage];
  }

  const result = await query(
    `INSERT INTO support_tickets (email, phone, subject, message, status, priority, assigned_to, data)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     RETURNING *`,
    [email, phone, subject, message, status, priority, assignedTo, JSON.stringify(data)]
  );
  return rowToTicketWithMessages(result.rows[0]);
}

async function listSupportTickets({ status, limit = 100 } = {}) {
  const params = [];
  let where = '';
  if (status && status !== 'all') {
    params.push(status);
    where = `WHERE status = $${params.length}`;
  }
  params.push(Math.min(Number(limit) || 100, 250));

  const result = await query(
    `SELECT * FROM support_tickets ${where} ORDER BY updated_at DESC LIMIT $${params.length}`,
    params
  );
  return result.rows.map(rowToTicket);
}

async function getSupportTicket(ticketId) {
  const result = await query(`SELECT * FROM support_tickets WHERE id = $1`, [ticketId]);
  return rowToTicketWithMessages(result.rows[0]);
}

async function findActiveTicketByPhone(phone, { source, openStatuses } = {}) {
  const result = await query(
    `SELECT * FROM support_tickets
     WHERE phone = $1
       AND ($2::text IS NULL OR data->>'source' = $2)
       AND status = ANY($3)
     ORDER BY updated_at DESC
     LIMIT 1`,
    [phone, source || null, openStatuses || ['open', 'in_progress', 'waiting_user', 'escalated']]
  );
  return rowToTicketWithMessages(result.rows[0]);
}

async function updateSupportTicket(ticketId, updates = {}) {
  const typedColumns = { status: 'status', priority: 'priority', assignedTo: 'assigned_to' };
  const sets = [];
  const params = [];
  const extraData = {};

  Object.entries(updates).forEach(([key, value]) => {
    if (typedColumns[key]) {
      params.push(value);
      sets.push(`${typedColumns[key]} = $${params.length}`);
    } else {
      extraData[key] = value;
    }
  });

  if (Object.keys(extraData).length > 0) {
    params.push(JSON.stringify(extraData));
    sets.push(`data = data || $${params.length}::jsonb`);
  }

  sets.push('updated_at = NOW()');
  params.push(ticketId);

  const result = await query(
    `UPDATE support_tickets SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params
  );
  return rowToTicketWithMessages(result.rows[0]);
}

// Appends a message into data.messages (atomic jsonb array concat) and
// updates the ticket's lastMessage/messageCount/status columns in one query.
// All jsonb_set calls must nest into a single expression -- Postgres
// evaluates every assignment in a SET list against the pre-update row, so
// separate `data = jsonb_set(data, ...)` assignments would silently discard
// all but the last one instead of composing.
async function appendSupportTicketMessage(ticketId, message, { status, messageCount } = {}) {
  const params = [
    ticketId,
    JSON.stringify([message]),
    JSON.stringify(message.body || ''),
    JSON.stringify(new Date().toISOString()),
    JSON.stringify(messageCount)
  ];

  const dataExpr = `jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(COALESCE(data, '{}'::jsonb), '{messages}', COALESCE(data->'messages', '[]'::jsonb) || $2::jsonb, true),
        '{lastMessage}', $3::jsonb, true
      ),
      '{lastMessageAt}', $4::jsonb, true
    ),
    '{messageCount}', $5::jsonb, true
  )`;

  const sets = [`data = ${dataExpr}`, 'updated_at = NOW()'];

  if (status) {
    params.push(status);
    sets.push(`status = $${params.length}`);
  }

  const result = await query(
    `UPDATE support_tickets SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
    params
  );
  return rowToTicketWithMessages(result.rows[0]);
}

module.exports = {
  createSupportTicket,
  listSupportTickets,
  getSupportTicket,
  findActiveTicketByPhone,
  updateSupportTicket,
  appendSupportTicketMessage,
  rowToTicket,
  rowToTicketWithMessages
};
