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

    const onboardingModule = await import('@/lib/automation/onboarding-queue-adapter.cjs');
    const claimAdvertWithToken =
      onboardingModule.claimAdvertWithToken ||
      onboardingModule.default?.claimAdvertWithToken;
    const shouldUsePostgresOnboarding =
      onboardingModule.shouldUsePostgresOnboarding ||
      onboardingModule.default?.shouldUsePostgresOnboarding;

    const result = await claimAdvertWithToken({
      rawToken: token,
      userId: authResult.userId
    });

    if (!shouldUsePostgresOnboarding?.()) {
      const { getAdminFirestore } = await import('@/lib/firebase-admin');
      const db = getAdminFirestore();
      const queueSnapshot = await db.collection('onboardingOutreachQueue')
        .where('advertId', '==', result.advertId)
        .where('collectionName', '==', result.collectionName)
        .limit(10)
        .get();

      await Promise.all(queueSnapshot.docs.map((doc) =>
        doc.ref.update({
          status: 'claimed',
          claimedAt: new Date(),
          claimedByUserId: authResult.userId,
          updatedAt: new Date()
        }).catch(() => null)
      ));
    }

    logEvent({
      advertId: result.advertId,
      collectionName: result.collectionName,
      eventType: 'ad_claimed',
      metadata: { claimedByUserId: authResult.userId }
    }).catch(() => null);

    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error) {
    const status =
      error.code === 'INVALID_TOKEN' || error.code === 'TOKEN_EXPIRED' ? 400 :
      error.code === 'TOKEN_ALREADY_CLAIMED' || error.code === 'ADVERT_NOT_CLAIMABLE' ? 409 :
      500;

    return NextResponse.json(
      {
        success: false,
        code: error.code || 'CLAIM_FAILED',
        error: error.message || 'Failed to claim advert'
      },
      { status }
    );
  }
}

