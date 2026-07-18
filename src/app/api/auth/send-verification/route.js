export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import { getAdminAuth } from '@/lib/firebase-admin';
import logger from '@/lib/logger';
import { sendVerificationEmailForUser } from '@/lib/email/verification-service';

const errorResponse = (message, code, status = 500) =>
  NextResponse.json({ success: false, error: message, code }, { status });

const authErrorResponse = async (authError) => {
  const status = authError?.status || 401;
  const payload = await authError?.clone?.().json?.().catch(() => ({}));
  const message = payload?.error || 'Authentication required';
  const code = status === 403 ? 'FORBIDDEN' : status === 503 ? 'AUTH_SERVICE_UNAVAILABLE' : 'UNAUTHORIZED';
  return errorResponse(message, code, status);
};

export async function POST(request) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authErrorResponse(authResult.error);
    }

    const body = await request.json().catch(() => ({}));
    const requestedEmail = String(body?.email || '').trim().toLowerCase();
    const authenticatedEmail = String(authResult.user?.email || '').trim().toLowerCase();
    const email = requestedEmail || authenticatedEmail;

    if (!email) {
      return errorResponse('Email is required', 'EMAIL_REQUIRED', 400);
    }

    if (requestedEmail && authenticatedEmail && requestedEmail !== authenticatedEmail) {
      return errorResponse(
        'You can only request verification for your authenticated email',
        'VERIFICATION_EMAIL_FORBIDDEN',
        403
      );
    }

    const adminAuth = getAdminAuth();
    const userRecord = await adminAuth.getUser(authResult.userId);
    if (!userRecord || !userRecord.email) {
      return errorResponse('User email not found', 'USER_EMAIL_NOT_FOUND', 404);
    }

    if (userRecord.email.toLowerCase() !== email) {
      return errorResponse(
        'Authenticated user email does not match request',
        'VERIFICATION_EMAIL_MISMATCH',
        403
      );
    }

    const result = await sendVerificationEmailForUser({
      uid: authResult.userId,
      email,
      displayName: authResult.user?.name || userRecord.displayName || ''
    });

    if (result.alreadyVerified) {
      return NextResponse.json({
        success: true,
        message: 'Email is already verified'
      });
    }

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          code: result.reasonCode || 'MAIL_PROVIDER_UNAVAILABLE',
          error: 'Email provider unavailable. Verification link saved for manual testing.',
          manualFallback: {
            mailLogId: result.mailLogId || null,
            fallbackStored: Boolean(result.fallbackStored)
          }
        },
        { status: 202 }
      );
    }

    return NextResponse.json({
      success: true,
      code: 'VERIFICATION_EMAIL_SENT',
      message: 'Verification email sent successfully'
    });
  } catch (error) {
    logger.error('Failed to trigger verification email', error);
    return errorResponse('Failed to send verification email', 'VERIFICATION_EMAIL_SEND_FAILED', 500);
  }
}
