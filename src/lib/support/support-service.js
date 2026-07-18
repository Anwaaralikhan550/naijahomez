import { getAdminFirestore } from '@/lib/firebase-admin';
import { sendMail } from '@/lib/email/mailer';

const TICKETS_COLLECTION = 'supportTickets';
const MESSAGES_COLLECTION = 'supportTicketMessages';
const EMAIL_LOGS_COLLECTION = 'supportEmailLogs';

const ALLOWED_TYPES = new Set(['general', 'support', 'technical', 'complaint', 'fraud', 'report', 'partnership', 'billing', 'whatsapp']);
const ALLOWED_STATUSES = new Set(['open', 'in_progress', 'waiting_user', 'escalated', 'resolved', 'closed']);
const ALLOWED_PRIORITIES = new Set(['low', 'normal', 'high', 'urgent']);

function cleanText(value, maxLength = 500) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function cleanMultiline(value, maxLength = 3000) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
    .slice(0, maxLength);
}

function normalizeEmail(value) {
  const email = cleanText(value, 180).toLowerCase();
  if (!email) return '';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function normalizePhone(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 18 ? digits : '';
}

function normalizeType(value) {
  const type = cleanText(value, 40).toLowerCase();
  if (!type) return 'general';
  if (type === 'report') return 'fraud';
  return ALLOWED_TYPES.has(type) ? type : 'general';
}

function priorityForType(type) {
  if (type === 'fraud' || type === 'complaint') return 'high';
  if (type === 'technical' || type === 'support') return 'normal';
  return 'normal';
}

function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIso(value) {
  const date = toDate(value);
  return date ? date.toISOString() : null;
}

function createTicketNumber(date = new Date()) {
  const stamp = date.toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `NJH-${stamp}-${suffix}`;
}

function mapTicket(doc) {
  const data = doc.data?.() || doc.data || {};
  return {
    id: doc.id,
    ticketNumber: data.ticketNumber || null,
    source: data.source || 'web',
    channel: data.channel || 'web',
    type: data.type || 'general',
    priority: data.priority || 'normal',
    status: data.status || 'open',
    name: data.name || null,
    email: data.email || null,
    phone: data.phone || null,
    subject: data.subject || 'Support request',
    message: data.message || '',
    lastMessage: data.lastMessage || data.message || '',
    messageCount: data.messageCount || 0,
    assignedTo: data.assignedTo || null,
    escalatedTo: data.escalatedTo || null,
    escalationReason: data.escalationReason || null,
    resolutionNote: data.resolutionNote || null,
    metadata: data.metadata || {},
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
    lastMessageAt: toIso(data.lastMessageAt),
    escalatedAt: toIso(data.escalatedAt),
    resolvedAt: toIso(data.resolvedAt)
  };
}

function mapMessage(doc) {
  const data = doc.data?.() || doc.data || {};
  return {
    id: doc.id,
    ticketId: data.ticketId || null,
    direction: data.direction || 'inbound',
    channel: data.channel || 'web',
    body: data.body || '',
    fromName: data.fromName || null,
    fromEmail: data.fromEmail || null,
    fromPhone: data.fromPhone || null,
    createdBy: data.createdBy || null,
    createdAt: toIso(data.createdAt)
  };
}

async function logSupportEmail({ ticketId, to, subject, status, error }) {
  try {
    const db = getAdminFirestore();
    await db.collection(EMAIL_LOGS_COLLECTION).add({
      ticketId: ticketId || null,
      to: to || null,
      subject: subject || null,
      status,
      error: error ? cleanText(error.message || error, 500) : null,
      createdAt: new Date()
    });
  } catch (logError) {
    console.error('Failed to write support email log:', logError);
  }
}

async function notifySupportTeam(ticket) {
  const to = process.env.SUPPORT_EMAIL_TO || process.env.CONTACT_EMAIL_TO || 'contact@nijahomzs.com';
  const subject = `[Nijahomzs Support] ${ticket.ticketNumber}: ${ticket.subject}`;
  const text = [
    `New support ticket: ${ticket.ticketNumber}`,
    `Source: ${ticket.source}`,
    `Type: ${ticket.type}`,
    `Priority: ${ticket.priority}`,
    `Name: ${ticket.name || 'Not provided'}`,
    `Email: ${ticket.email || 'Not provided'}`,
    `Phone: ${ticket.phone || 'Not provided'}`,
    '',
    ticket.message || ''
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
      <h2 style="color:#003f88">New Nijahomzs Support Ticket</h2>
      <p><strong>Ticket:</strong> ${ticket.ticketNumber}</p>
      <p><strong>Source:</strong> ${ticket.source}</p>
      <p><strong>Type:</strong> ${ticket.type}</p>
      <p><strong>Priority:</strong> ${ticket.priority}</p>
      <p><strong>Name:</strong> ${ticket.name || 'Not provided'}</p>
      <p><strong>Email:</strong> ${ticket.email || 'Not provided'}</p>
      <p><strong>Phone:</strong> ${ticket.phone || 'Not provided'}</p>
      <hr />
      <p>${String(ticket.message || '').replace(/\n/g, '<br />')}</p>
    </div>
  `;

  try {
    await sendMail({ to, subject, text, html });
    await logSupportEmail({ ticketId: ticket.id, to, subject, status: 'sent' });
    return { success: true };
  } catch (error) {
    await logSupportEmail({ ticketId: ticket.id, to, subject, status: 'failed', error });
    return { success: false, error: error.message || 'Email notification failed' };
  }
}

export async function createSupportTicket(input = {}) {
  const name = cleanText(input.name, 120);
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  const type = normalizeType(input.type);
  const subject = cleanText(input.subject, 180) || `${type.charAt(0).toUpperCase()}${type.slice(1)} support request`;
  const message = cleanMultiline(input.message, 3000);
  const source = cleanText(input.source, 40) || 'contact_form';
  const channel = cleanText(input.channel, 40) || (source === 'whatsapp' ? 'whatsapp' : 'web');
  const now = new Date();

  if (!name && !phone && !email) {
    throw Object.assign(new Error('Please provide your name, email, or phone number.'), { status: 400, code: 'CONTACT_REQUIRED' });
  }

  if (!message || message.length < 5) {
    throw Object.assign(new Error('Message must be at least 5 characters.'), { status: 400, code: 'MESSAGE_TOO_SHORT' });
  }

  if (input.email && !email) {
    throw Object.assign(new Error('Please provide a valid email address.'), { status: 400, code: 'INVALID_EMAIL' });
  }

  const db = getAdminFirestore();
  const ticketData = {
    ticketNumber: createTicketNumber(now),
    source,
    channel,
    type,
    priority: ALLOWED_PRIORITIES.has(input.priority) ? input.priority : priorityForType(type),
    status: 'open',
    name: name || 'Nijahomzs user',
    email: email || null,
    phone: phone || null,
    subject,
    message,
    lastMessage: message,
    messageCount: 1,
    assignedTo: null,
    escalatedTo: null,
    escalationReason: null,
    resolutionNote: null,
    metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : {},
    createdAt: now,
    updatedAt: now,
    lastMessageAt: now
  };

  const ticketRef = await db.collection(TICKETS_COLLECTION).add(ticketData);
  await ticketRef.collection(MESSAGES_COLLECTION).add({
    ticketId: ticketRef.id,
    direction: 'inbound',
    channel,
    body: message,
    fromName: ticketData.name,
    fromEmail: email || null,
    fromPhone: phone || null,
    createdAt: now
  });

  const ticket = { id: ticketRef.id, ...ticketData };
  const emailNotification = await notifySupportTeam(ticket);
  return { ...mapTicket({ id: ticketRef.id, data: () => ticketData }), emailNotification };
}

export async function listSupportTickets({ status, limit = 100 } = {}) {
  const db = getAdminFirestore();
  const snapshot = await db.collection(TICKETS_COLLECTION).limit(Math.min(Number(limit) || 100, 250)).get();
  let tickets = snapshot.docs.map(mapTicket);
  if (status && status !== 'all') {
    tickets = tickets.filter((ticket) => ticket.status === status);
  }
  tickets.sort((a, b) => Date.parse(b.updatedAt || b.createdAt || 0) - Date.parse(a.updatedAt || a.createdAt || 0));
  return tickets;
}

export async function getSupportTicket(ticketId) {
  const db = getAdminFirestore();
  const ticketRef = db.collection(TICKETS_COLLECTION).doc(ticketId);
  const ticketDoc = await ticketRef.get();
  if (!ticketDoc.exists) return null;
  const messagesSnapshot = await ticketRef.collection(MESSAGES_COLLECTION).limit(100).get();
  const messages = messagesSnapshot.docs.map(mapMessage).sort((a, b) => Date.parse(a.createdAt || 0) - Date.parse(b.createdAt || 0));
  return { ...mapTicket(ticketDoc), messages };
}

export async function updateSupportTicket({ ticketId, action, status, priority, note, assignee, escalationReason, adminId }) {
  const db = getAdminFirestore();
  const ticketRef = db.collection(TICKETS_COLLECTION).doc(ticketId);
  const ticketDoc = await ticketRef.get();
  if (!ticketDoc.exists) {
    throw Object.assign(new Error('Support ticket not found.'), { status: 404, code: 'TICKET_NOT_FOUND' });
  }

  const now = new Date();
  const updates = { updatedAt: now };
  const cleanAction = cleanText(action, 40).toLowerCase();

  if (priority) {
    const cleanPriority = cleanText(priority, 20).toLowerCase();
    if (!ALLOWED_PRIORITIES.has(cleanPriority)) {
      throw Object.assign(new Error('Invalid priority.'), { status: 400, code: 'INVALID_PRIORITY' });
    }
    updates.priority = cleanPriority;
  }

  if (status) {
    const cleanStatus = cleanText(status, 30).toLowerCase();
    if (!ALLOWED_STATUSES.has(cleanStatus)) {
      throw Object.assign(new Error('Invalid status.'), { status: 400, code: 'INVALID_STATUS' });
    }
    updates.status = cleanStatus;
  }

  if (cleanAction === 'assign') {
    updates.assignedTo = cleanText(assignee || adminId, 120) || adminId || null;
    updates.status = updates.status || 'in_progress';
  }

  if (cleanAction === 'escalate') {
    const reason = cleanMultiline(escalationReason || note, 1000);
    if (reason.length < 5) {
      throw Object.assign(new Error('Escalation reason is required.'), { status: 400, code: 'ESCALATION_REASON_REQUIRED' });
    }
    updates.status = 'escalated';
    updates.priority = priority || 'urgent';
    updates.escalationReason = reason;
    updates.escalatedTo = cleanText(assignee, 120) || 'dev_team';
    updates.escalatedAt = now;
  }

  if (cleanAction === 'resolve') {
    const resolution = cleanMultiline(note, 1000);
    if (resolution.length < 3) {
      throw Object.assign(new Error('Resolution note is required.'), { status: 400, code: 'RESOLUTION_REQUIRED' });
    }
    updates.status = 'resolved';
    updates.resolutionNote = resolution;
    updates.resolvedAt = now;
    updates.resolvedBy = adminId || null;
  }

  if (cleanAction === 'close') {
    updates.status = 'closed';
  }

  await ticketRef.set(updates, { merge: true });
  return getSupportTicket(ticketId);
}

export async function addSupportTicketMessage({ ticketId, direction = 'outbound', channel = 'web', body, fromName, fromEmail, fromPhone, createdBy }) {
  const messageBody = cleanMultiline(body, 3000);
  if (messageBody.length < 1) {
    throw Object.assign(new Error('Reply message is required.'), { status: 400, code: 'MESSAGE_REQUIRED' });
  }

  const db = getAdminFirestore();
  const ticketRef = db.collection(TICKETS_COLLECTION).doc(ticketId);
  const ticketDoc = await ticketRef.get();
  if (!ticketDoc.exists) {
    throw Object.assign(new Error('Support ticket not found.'), { status: 404, code: 'TICKET_NOT_FOUND' });
  }

  const now = new Date();
  await ticketRef.collection(MESSAGES_COLLECTION).add({
    ticketId,
    direction,
    channel,
    body: messageBody,
    fromName: cleanText(fromName, 120) || null,
    fromEmail: normalizeEmail(fromEmail) || null,
    fromPhone: normalizePhone(fromPhone) || null,
    createdBy: createdBy || null,
    createdAt: now
  });

  await ticketRef.set({
    lastMessage: messageBody,
    messageCount: (ticketDoc.data()?.messageCount || 0) + 1,
    lastMessageAt: now,
    updatedAt: now,
    status: direction === 'outbound' ? 'waiting_user' : 'open'
  }, { merge: true });

  return getSupportTicket(ticketId);
}

export async function sendSupportReply({ ticketId, channel, message, adminId }) {
  const ticket = await getSupportTicket(ticketId);
  if (!ticket) {
    throw Object.assign(new Error('Support ticket not found.'), { status: 404, code: 'TICKET_NOT_FOUND' });
  }

  const cleanChannel = cleanText(channel, 20).toLowerCase() || 'email';
  const body = cleanMultiline(message, 3000);
  if (body.length < 2) {
    throw Object.assign(new Error('Reply message is required.'), { status: 400, code: 'MESSAGE_REQUIRED' });
  }

  if (cleanChannel === 'email') {
    if (!ticket.email) {
      throw Object.assign(new Error('This ticket has no email address.'), { status: 400, code: 'EMAIL_MISSING' });
    }
    const subject = `Re: ${ticket.subject} (${ticket.ticketNumber})`;
    try {
      await sendMail({
        to: ticket.email,
        subject,
        text: body,
        html: `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827"><p>${body.replace(/\n/g, '<br />')}</p><hr /><p style="color:#6b7280">Nijahomzs Support</p></div>`
      });
      await logSupportEmail({ ticketId, to: ticket.email, subject, status: 'sent' });
    } catch (error) {
      await logSupportEmail({ ticketId, to: ticket.email, subject, status: 'failed', error });
      throw error;
    }
  } else if (cleanChannel === 'whatsapp') {
    if (!ticket.phone) {
      throw Object.assign(new Error('This ticket has no WhatsApp phone number.'), { status: 400, code: 'PHONE_MISSING' });
    }
    const mod = await import('@/lib/whatsapp/evolution-client');
    const sendEvolutionTextMessage = mod.sendEvolutionTextMessage || mod.default?.sendEvolutionTextMessage;
    await sendEvolutionTextMessage({ to: ticket.phone, text: body });
  } else {
    throw Object.assign(new Error('Reply channel must be email or whatsapp.'), { status: 400, code: 'INVALID_REPLY_CHANNEL' });
  }

  return addSupportTicketMessage({
    ticketId,
    direction: 'outbound',
    channel: cleanChannel,
    body,
    fromName: 'Nijahomzs Support',
    createdBy: adminId || null
  });
}

export async function createWhatsAppSupportTicket({ phone, text, metadata }) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone || !cleanMultiline(text, 3000)) {
    return { ignored: true, reason: 'missing_phone_or_text' };
  }

  const db = getAdminFirestore();
  const recentSnapshot = await db
    .collection(TICKETS_COLLECTION)
    .where('phone', '==', normalizedPhone)
    .limit(25)
    .get();

  const activeTicket = recentSnapshot.docs
    .map(mapTicket)
    .filter((ticket) => ticket.source === 'whatsapp')
    .filter((ticket) => ['open', 'in_progress', 'waiting_user', 'escalated'].includes(ticket.status))
    .sort((a, b) => Date.parse(b.updatedAt || b.createdAt || 0) - Date.parse(a.updatedAt || a.createdAt || 0))[0];

  if (activeTicket) {
    return addSupportTicketMessage({
      ticketId: activeTicket.id,
      direction: 'inbound',
      channel: 'whatsapp',
      body: text,
      fromName: 'WhatsApp user',
      fromPhone: normalizedPhone
    });
  }

  return createSupportTicket({
    name: 'WhatsApp user',
    phone: normalizedPhone,
    type: 'whatsapp',
    subject: `WhatsApp support message from ${normalizedPhone}`,
    message: text,
    source: 'whatsapp',
    channel: 'whatsapp',
    metadata: metadata || {}
  });
}

export const supportCollections = {
  TICKETS_COLLECTION,
  MESSAGES_COLLECTION,
  EMAIL_LOGS_COLLECTION
};
