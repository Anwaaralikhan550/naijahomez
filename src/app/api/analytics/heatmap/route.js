import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function engine() {
  const mod = await import('@/lib/advertising/ad-engine');
  return mod.default || mod;
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await (await engine()).recordHeatmapEvent({
      page: body.page || '',
      element: body.element || '',
      xPercent: body.xPercent,
      yPercent: body.yPercent,
      viewport: body.viewport || '',
      device: body.device || ''
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to record heatmap event' },
      { status: 500 }
    );
  }
}
