export const dynamic = 'force-dynamic';
﻿import { NextResponse } from 'next/server';
import { createSupportTicket } from '@/lib/support/support-service';

export const runtime = 'nodejs';

function errorResponse(error) {
  return NextResponse.json(
    {
      success: false,
      error: error.message || 'Failed to create support ticket',
      code: error.code || 'SUPPORT_TICKET_CREATE_FAILED'
    },
    { status: error.status || 500 }
  );
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload', code: 'INVALID_JSON' },
        { status: 400 }
      );
    }

    const ticket = await createSupportTicket({
      name: body.name,
      email: body.email,
      phone: body.phone,
      type: body.type,
      subject: body.subject,
      message: body.message,
      source: 'contact_form',
      channel: 'web',
      metadata: {
        userAgent: request.headers.get('user-agent') || null,
        page: body.page || '/contact'
      }
    });

    return NextResponse.json({
      success: true,
      ticket: {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        status: ticket.status,
        emailNotification: ticket.emailNotification
      },
      message: 'Support ticket created successfully.'
    });
  } catch (error) {
    console.error('Support ticket create error:', error);
    return errorResponse(error);
  }
}
