export const dynamic = 'force-dynamic';
import crypto from 'crypto';
import { NextResponse } from 'next/server';
import authRepository from '@/lib/db/auth-repository.cjs';
import { sendMail } from '@/lib/email/mailer';
import { buildPasswordResetEmailTemplate } from '@/lib/templates/passwordResetEmail';
import logger from '@/lib/logger';

const TOKEN_TTL_HOURS = 1;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getAppBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail(body.email);

    // Always return success regardless of whether the account exists --
    // do not leak account existence via response timing/shape.
    const genericResponse = NextResponse.json({
      success: true,
      message: 'If an account exists for that email, a reset link has been sent.'
    });

    if (!email) return genericResponse;

    const profile = await authRepository.getUserProfileByEmail(email);
    if (!profile) return genericResponse;

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000);

    await authRepository.createPasswordResetToken(profile.userId, tokenHash, expiresAt);

    const resetUrl = `${getAppBaseUrl()}/reset-password?token=${encodeURIComponent(rawToken)}&uid=${encodeURIComponent(profile.userId)}`;
    const template = buildPasswordResetEmailTemplate({
      displayName: profile.displayName,
      resetUrl,
      expiresInHours: TOKEN_TTL_HOURS
    });

    await sendMail({ to: email, subject: 'Reset your NaijaHomz password', html: template.html, text: template.text }).catch((error) => {
      logger.warn('Failed to send password reset email', { userId: profile.userId, error: error.message });
    });

    return genericResponse;
  } catch (error) {
    logger.error('Forgot-password request failed', error);
    // Still return a generic success shape -- errors here must not leak info.
    return NextResponse.json({
      success: true,
      message: 'If an account exists for that email, a reset link has been sent.'
    });
  }
}
