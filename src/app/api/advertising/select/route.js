import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function engine() {
  const mod = await import('@/lib/advertising/ad-engine');
  return mod.default || mod;
}

export async function GET(request) {
  try {
    const params = request.nextUrl.searchParams;
    const ads = await (await engine()).selectAd({
      slot: params.get('slot') || '',
      location: params.get('location') || '',
      propertyCategory: params.get('propertyCategory') || '',
      limit: params.get('limit') || 1
    });
    return NextResponse.json({ success: true, ads });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to select ads' },
      { status: error.status || 500 }
    );
  }
}
