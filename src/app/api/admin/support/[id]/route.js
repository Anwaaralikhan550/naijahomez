export const dynamic = 'force-dynamic';
﻿import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth-middleware';
import { getSupportTicket, updateSupportTicket, sendSupportReply } from '@/lib/support/support-service';

export const runtime = 'nodejs';

function getTicketId(context) {
  return context?.params?.id || context?.params?.ticketId;
}

function errorResponse(error) {
  return NextResponse.json(
    { success: false, error: error.message || 'Support ticket update failed', code: error.code || 'SUPPORT_TICKET_UPDATE_FAILED' },
    { status: error.status || 500 }
  );
}

export async function GET(request, context) {
  try {
    const adminResult = await isAdmin(request);
    if (!adminResult.success) return adminResult.error;

    const ticketId = getTicketId(context);
    const ticket = await getSupportTicket(ticketId);
    if (!ticket) {
      return NextResponse.json({ success: false, error: 'Support ticket not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, ticket });
  } catch (error) {
    console.error('Support ticket admin get error:', error);
    return errorResponse(error);
  }
}

export async function PATCH(request, context) {
  try {
    const adminResult = await isAdmin(request);
    if (!adminResult.success) return adminResult.error;

    const ticketId = getTicketId(context);
    const body = await request.json().catch(() => ({}));

    if (body.action === 'reply') {
      const ticket = await sendSupportReply({
        ticketId,
        channel: body.channel,
        message: body.message,
        adminId: adminResult.userId
      });
      return NextResponse.json({ success: true, ticket });
    }

    const ticket = await updateSupportTicket({
      ticketId,
      action: body.action,
      status: body.status,
      priority: body.priority,
      note: body.note,
      assignee: body.assignee,
      escalationReason: body.escalationReason,
      adminId: adminResult.userId
    });

    return NextResponse.json({ success: true, ticket });
  } catch (error) {
    console.error('Support ticket admin patch error:', error);
    return errorResponse(error);
  }
}
