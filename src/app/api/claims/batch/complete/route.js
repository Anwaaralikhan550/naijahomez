export const dynamic = 'force-dynamic';
﻿import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import { logEvent } from '@/lib/db/outreach-events-repository.cjs';

export async function POST(request) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const payload = await request.json().catch(() => ({}));
    const token = payload.token || '';
    const advertIds = Array.isArray(payload.advertIds) ? payload.advertIds : null;

    const onboardingModule = await import('@/lib/automation/onboarding-queue-adapter.cjs');
    const claimBatchWithToken =
      onboardingModule.claimBatchWithToken ||
      onboardingModule.default?.claimBatchWithToken;

    const result = await claimBatchWithToken({
      rawToken: token,
      userId: authResult.userId,
      advertIds
    });

    logEvent({
      batchTokenId: result.batchId,
      eventType: 'ad_claimed',
      metadata: { claimedByUserId: authResult.userId, claimedAdvertIds: result.claimedAdvertIds }
    }).catch(() => null);

    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error) {
    const status =
      error.code === 'INVALID_TOKEN' || error.code === 'TOKEN_EXPIRED' ? 400 :
      error.code === 'NO_CLAIMABLE_ADVERTS' || error.code === 'ADVERT_NOT_CLAIMABLE' ? 409 :
      500;

    return NextResponse.json(
      {
        success: false,
        code: error.code || 'BATCH_CLAIM_FAILED',
        error: error.message || 'Failed to claim adverts'
      },
      { status }
    );
  }
}

