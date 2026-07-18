import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function engine() {
  const mod = await import('@/lib/advertising/ad-engine');
  return mod.default || mod;
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const impressions = Array.isArray(body.impressions) ? body.impressions : [];
    const result = await (await engine()).recordAdImpressions({ impressions });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to record impressions' },
      { status: error.status || 500 }
    );
  }
}
