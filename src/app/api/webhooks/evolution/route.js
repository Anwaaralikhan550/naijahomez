export const dynamic = 'force-dynamic';
﻿import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function getHeader(request, name) {
  return request.headers.get(name) || request.headers.get(name.toLowerCase());
}

function isAuthorized(request) {
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET;
  if (!secret) return true;

  const bearer = getHeader(request, 'authorization') || '';
  const provided =
    getHeader(request, 'x-evolution-webhook-secret') ||
    getHeader(request, 'x-webhook-secret') ||
    getHeader(request, 'apikey') ||
    bearer.replace(/^Bearer\s+/i, '');

  return provided === secret;
}

function getByPath(payload, path) {
  return path.split('.').reduce((value, key) => value?.[key], payload);
}

function extractPhone(payload) {
  const candidates = [
    'data.key.remoteJid',
    'data.remoteJid',
    'data.sender',
    'data.from',
    'data.message.key.remoteJid',
    'key.remoteJid',
    'remoteJid',
    'sender',
    'from'
  ];

  for (const path of candidates) {
    const value = getByPath(payload, path);
    if (value) return String(value).split('@')[0];
  }

  return null;
}

function extractTextValues(value, texts = []) {
  if (!value) return texts;

  if (typeof value === 'string') {
    texts.push(value);
    return texts;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => extractTextValues(item, texts));
    return texts;
  }

  if (typeof value === 'object') {
    Object.entries(value).forEach(([key, child]) => {
      if (['conversation', 'text', 'body', 'caption', 'message'].includes(key)) {
        extractTextValues(child, texts);
      } else if (typeof child === 'object') {
        extractTextValues(child, texts);
      }
    });
  }

  return texts;
}

function extractText(payload) {
  return extractTextValues(payload)
    .map((text) => String(text || '').trim())
    .filter(Boolean)
    .join(' ')
    .slice(0, 3000);
}

function isStopMessage(text) {
  return /\bstop\b/i.test(text || '');
}

function isOutgoingMessage(payload) {
  return Boolean(
    payload?.data?.key?.fromMe ||
    payload?.key?.fromMe ||
    payload?.data?.fromMe
  );
}

export async function POST(request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await request.json().catch(() => ({}));
    if (isOutgoingMessage(payload)) {
      return NextResponse.json({ success: true, ignored: true, reason: 'outgoing_message' });
    }

    const phone = extractPhone(payload);
    const text = extractText(payload);

    if (!phone || !text) {
      return NextResponse.json({ success: true, ignored: true, reason: 'missing_phone_or_text' });
    }

    if (isStopMessage(text)) {
      const onboardingModule = await import('@/lib/automation/onboarding-queue-adapter.cjs');
      const suppressNumber =
        onboardingModule.suppressNumber ||
        onboardingModule.default?.suppressNumber;

      const result = await suppressNumber({
        phone,
        source: 'evolution_webhook',
        reason: 'STOP',
        rawPayload: payload
      });

      return NextResponse.json({ success: true, suppressed: true, ...result });
    }

    const supportModule = await import('@/lib/support/support-service');
    const createWhatsAppSupportTicket =
      supportModule.createWhatsAppSupportTicket ||
      supportModule.default?.createWhatsAppSupportTicket;

    const ticket = await createWhatsAppSupportTicket({
      phone,
      text,
      metadata: {
        event: payload?.event || payload?.type || null,
        instance: payload?.instance || payload?.instanceName || null,
        messageId: payload?.data?.key?.id || payload?.key?.id || null
      }
    });

    return NextResponse.json({
      success: true,
      inbox: true,
      ticket: ticket?.ignored ? ticket : {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        status: ticket.status
      }
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process Evolution webhook' },
      { status: 500 }
    );
  }
}

