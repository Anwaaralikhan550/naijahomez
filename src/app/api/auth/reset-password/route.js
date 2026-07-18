export const dynamic = 'force-dynamic';
import crypto from 'crypto';
import { NextResponse } from 'next/server';
import authRepository from '@/lib/db/auth-repository.cjs';
import { hashPassword, isStrongPassword } from '@/lib/auth/password';
import logger from '@/lib/logger';

const errorResponse = (message, code, status = 500) =>
  NextResponse.json({ success: false, error: message, code }, { status });

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = String(body.token || '');
    const newPassword = String(body.newPassword || '');

    if (!token) {
      return errorResponse('Reset token is required.', 'TOKEN_REQUIRED', 400);
    }

    if (!isStrongPassword(newPassword)) {
      return errorResponse(
        'Password must be at least 8 characters and include an uppercase letter, a number, and a symbol.',
        'WEAK_PASSWORD',
        400
      );
    }

    const userId = await authRepository.consumePasswordResetToken(hashToken(token));
    if (!userId) {
      return errorResponse('This reset link is invalid or has expired.', 'INVALID_TOKEN', 400);
    }

    const passwordHash = await hashPassword(newPassword);
    await authRepository.setPasswordHash(userId, { passwordHash, passwordAlgo: 'bcrypt' });

    // Force re-login everywhere -- standard practice after a password reset.
    await authRepository.revokeAllUserRefreshTokens(userId);

    return NextResponse.json({ success: true, message: 'Password has been reset. Please log in again.' });
  } catch (error) {
    logger.error('Reset-password failed', error);
    return errorResponse('Failed to reset password.', 'RESET_PASSWORD_FAILED', 500);
  }
}
