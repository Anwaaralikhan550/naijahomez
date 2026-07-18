import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

async function engine() {
  const mod = await import('@/lib/advertising/ad-engine');
  return mod.default || mod;
}

export async function POST(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.success) return auth.error;
    const body = await request.json().catch(() => ({}));
    const result = await (await engine()).verifyCampaignPayment({
      txRef: body.txRef || body.tx_ref,
      transactionId: body.transactionId || body.transaction_id
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to verify campaign payment' }, { status: error.status || 500 });
  }
}
