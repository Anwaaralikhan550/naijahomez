import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

async function engine() {
  const mod = await import('@/lib/advertising/ad-engine');
  return mod.default || mod;
}

async function authOrError(request) {
  const result = await verifyAuth(request);
  if (!result.success) return { error: result.error };
  return result;
}

export async function GET(request) {
  try {
    const auth = await authOrError(request);
    if (auth.error) return auth.error;
    const campaigns = await (await engine()).listUserCampaigns(auth.userId);
    return NextResponse.json({ success: true, campaigns });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to load campaigns' }, { status: error.status || 500 });
  }
}

export async function POST(request) {
  try {
    const auth = await authOrError(request);
    if (auth.error) return auth.error;
    const body = await request.json().catch(() => ({}));
    const campaign = await (await engine()).createCampaign({
      userId: auth.userId,
      userEmail: auth.user?.email,
      data: body
    });
    return NextResponse.json({ success: true, campaign });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to create campaign' }, { status: error.status || 500 });
  }
}
