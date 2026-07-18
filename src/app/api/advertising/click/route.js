import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function engine() {
  const mod = await import('@/lib/advertising/ad-engine');
  return mod.default || mod;
}

async function recordAndRedirect(request, data = {}) {
  const params = request.nextUrl.searchParams;
  const campaignId = data.campaignId || params.get('campaignId') || '';
  const slot = data.slot || params.get('slot') || '';
  const location = data.location || params.get('location') || '';
  const propertyCategory = data.propertyCategory || params.get('propertyCategory') || '';
  const destination = data.destinationUrl || params.get('to') || '/';

  const adEngine = await engine();
  await adEngine.recordAdClick({ campaignId, slot, location, propertyCategory });
  await adEngine.recordJourneyEvent({ step: 'campaign_click', source: slot, location, listingType: propertyCategory });

  return NextResponse.redirect(new URL(destination, request.nextUrl.origin));
}

export async function GET(request) {
  try {
    return await recordAndRedirect(request);
  } catch (error) {
    return NextResponse.redirect(new URL('/', request.nextUrl.origin));
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    await recordAndRedirect(request, body);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to record ad click' },
      { status: error.status || 500 }
    );
  }
}
