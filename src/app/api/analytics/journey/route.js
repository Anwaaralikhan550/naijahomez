import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function engine() {
  const mod = await import('@/lib/advertising/ad-engine');
  return mod.default || mod;
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await (await engine()).recordJourneyEvent({
      step: body.step,
      source: body.source || '',
      location: body.location || '',
      listingType: body.listingType || '',
      page: body.page || '',
      device: body.device || '',
      element: body.element || ''
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to record journey event' }, { status: 500 });
  }
}
