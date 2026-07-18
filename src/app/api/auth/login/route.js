export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import authRepository from '@/lib/db/auth-repository.cjs';
import { verifyPassword } from '@/lib/auth/password';
import { issueSession } from '@/lib/auth/session';
import logger from '@/lib/logger';

const errorResponse = (message, code, status = 500) =>
  NextResponse.json({ success: false, error: message, code }, { status });

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail(body.email);
    const password = String(body.password || '');

    if (!email || !password) {
      return errorResponse('Email and password are required.', 'CREDENTIALS_REQUIRED', 400);
    }

    const credentials = await authRepository.getCredentialsByEmail(email);
    if (!credentials || !credentials.password_hash) {
      // Same generic message whether the account doesn't exist or has no
      // password set yet (e.g. Google-only account) -- don't leak which.
      return errorResponse('Invalid email or password.', 'INVALID_CREDENTIALS', 401);
    }

    if (credentials.locked_until && new Date(credentials.locked_until) > new Date()) {
      return errorResponse(
        'Too many failed attempts. Please try again later or reset your password.',
        'ACCOUNT_LOCKED',
        423
      );
    }

    const validPassword = await verifyPassword(password, credentials.password_hash);
    if (!validPassword) {
      await authRepository.recordFailedLogin(credentials.user_id, { maxAttempts: MAX_ATTEMPTS, lockMinutes: LOCK_MINUTES });
      return errorResponse('Invalid email or password.', 'INVALID_CREDENTIALS', 401);
    }

    await authRepository.resetFailedLogins(credentials.user_id);
    const profile = await authRepository.getUserProfileById(credentials.user_id);

    const userAgent = request.headers.get('user-agent') || null;
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
    const session = await issueSession(profile, { userAgent, ipAddress });

    return NextResponse.json({
      success: true,
      user: {
        uid: profile.userId,
        email: profile.email,
        displayName: profile.displayName,
        emailVerified: profile.emailVerified,
        isAdmin: profile.isAdmin,
        role: profile.role
      },
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt
    });
  } catch (error) {
    logger.error('Login failed', error);
    return errorResponse('Failed to log in.', 'LOGIN_FAILED', 500);
  }
}
