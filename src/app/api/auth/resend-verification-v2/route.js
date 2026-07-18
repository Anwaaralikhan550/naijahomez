export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import authRepository from '@/lib/db/auth-repository.cjs';
import { sendVerificationEmailV2 } from '@/lib/auth/email-verification-v2';
import logger from '@/lib/logger';

const errorResponse = (message, code, status = 500, extra = {}) =>
  NextResponse.json({ success: false, error: message, code, ...extra }, { status });

export async function POST(request) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) return authResult.error;

    const profile = await authRepository.getUserProfileById(authResult.userId);
    if (!profile?.email) {
      return errorResponse('User email not found', 'USER_EMAIL_NOT_FOUND', 404);
    }

    if (profile.emailVerified) {
      return NextResponse.json({ success: true, message: 'Email is already verified', code: 'ALREADY_VERIFIED' });
    }

    const result = await sendVerificationEmailV2({
      uid: authResult.userId,
      email: profile.email,
      displayName: profile.displayName || ''
    });

    if (!result.success) {
      return errorResponse('Failed to send verification email', 'VERIFICATION_EMAIL_FAILED', 502);
    }

    return NextResponse.json({ success: true, code: 'VERIFICATION_EMAIL_SENT', message: 'Verification email sent successfully' });
  } catch (error) {
    logger.error('Resend verification (v2) failed', error);
    return errorResponse('Failed to resend verification email', 'RESEND_VERIFICATION_FAILED', 500);
  }
}
