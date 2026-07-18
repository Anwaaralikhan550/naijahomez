export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import { getKycStatusForUser } from '@/lib/kyc/kyc-service';

export async function GET(request) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) return authResult.error;

    const status = await getKycStatusForUser(authResult.userId);
    return NextResponse.json({ success: true, ...status });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load KYC status' },
      { status: 500 }
    );
  }
}
