import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

async function engine() {
  const mod = await import('@/lib/advertising/ad-engine');
  return mod.default || mod;
}

export async function GET(request) {
  try {
    const admin = await isAdmin(request);
    if (!admin.success) return admin.error;
    const data = await (await engine()).listAdminAdvertising();
    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to load advertising admin' }, { status: error.status || 500 });
  }
}

export async function POST(request) {
  try {
    const admin = await isAdmin(request);
    if (!admin.success) return admin.error;
    const body = await request.json().catch(() => ({}));
    if (body.action === 'generateReports') {
      const report = await (await engine()).generateWeeklyReports();
      return NextResponse.json({ success: true, report });
    }
    const campaign = await (await engine()).updateCampaignStatus({
      campaignId: body.campaignId,
      action: body.action,
      adminId: admin.userId
    });
    return NextResponse.json({ success: true, campaign });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to update campaign' }, { status: error.status || 500 });
  }
}
