export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyEmailTokenV2 } from '@/lib/auth/email-verification-v2';
import logger from '@/lib/logger';

function getAppBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const uid = searchParams.get('uid');

    const result = await verifyEmailTokenV2({ uid, token });
    const baseUrl = getAppBaseUrl();

    if (!result.success) {
      return NextResponse.redirect(`${baseUrl}/verify-email?status=failed&code=${result.code || 'UNKNOWN'}`);
    }

    return NextResponse.redirect(`${baseUrl}/verify-email?status=success`);
  } catch (error) {
    logger.error('Email verification (v2) failed', error);
    return NextResponse.redirect(`${getAppBaseUrl()}/verify-email?status=failed&code=SERVER_ERROR`);
  }
}
