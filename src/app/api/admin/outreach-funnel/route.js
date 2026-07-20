export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth-middleware';
import { getAgentFunnel, getOutreachFunnelSummary } from '@/lib/db/outreach-events-repository.cjs';

export async function GET(request) {
  try {
    const adminResult = await isAdmin(request);
    if (!adminResult.success) {
      return adminResult.error;
    }

    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone') || null;
    const status = searchParams.get('status') || null;
    const limit = Number(searchParams.get('limit')) || 100;

    const [entries, summary] = await Promise.all([
      getAgentFunnel({ limit, phone, status }),
      getOutreachFunnelSummary()
    ]);

    return NextResponse.json({ success: true, entries, summary });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load outreach funnel' },
      { status: 500 }
    );
  }
}
