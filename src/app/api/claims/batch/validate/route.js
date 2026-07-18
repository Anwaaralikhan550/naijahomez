export const dynamic = 'force-dynamic';
﻿import { NextResponse } from 'next/server';

function isQuotaExceededError(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === 8 || message.includes('resource_exhausted') || message.includes('quota exceeded');
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token') || '';
    const onboardingModule = await import('@/lib/automation/onboarding-queue-adapter.cjs');
    const validateBatchClaimToken =
      onboardingModule.validateBatchClaimToken ||
      onboardingModule.default?.validateBatchClaimToken;

    const result = await validateBatchClaimToken({ rawToken: token });
    const status = result.valid ? 200 : 400;
    return NextResponse.json(result, { status });
  } catch (error) {
    if (isQuotaExceededError(error)) {
      return NextResponse.json(
        {
          valid: false,
          code: 'SERVICE_UNAVAILABLE',
          error: 'Claim service is temporarily unavailable. Please try again shortly.'
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { valid: false, code: 'VALIDATION_FAILED', error: error.message },
      { status: 500 }
    );
  }
}

