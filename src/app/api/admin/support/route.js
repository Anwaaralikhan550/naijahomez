export const dynamic = 'force-dynamic';
﻿import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth-middleware';
import { listSupportTickets } from '@/lib/support/support-service';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const adminResult = await isAdmin(request);
    if (!adminResult.success) return adminResult.error;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const limit = Number(searchParams.get('limit') || 100);
    const tickets = await listSupportTickets({ status, limit });

    const summary = tickets.reduce((acc, ticket) => {
      acc.total += 1;
      acc[ticket.status] = (acc[ticket.status] || 0) + 1;
      if (ticket.priority === 'urgent' || ticket.priority === 'high') acc.highPriority += 1;
      return acc;
    }, { total: 0, open: 0, in_progress: 0, waiting_user: 0, escalated: 0, resolved: 0, closed: 0, highPriority: 0 });

    return NextResponse.json({ success: true, tickets, summary });
  } catch (error) {
    console.error('Support tickets admin list error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load support tickets' },
      { status: 500 }
    );
  }
}
