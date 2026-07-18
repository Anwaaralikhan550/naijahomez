export const dynamic = 'force-dynamic';
import crypto from 'crypto';
import { NextResponse } from 'next/server';
import authRepository from '@/lib/db/auth-repository.cjs';
import { hashPassword, isStrongPassword } from '@/lib/auth/password';
import { issueSession } from '@/lib/auth/session';
import { sendVerificationEmailV2 } from '@/lib/auth/email-verification-v2';
import logger from '@/lib/logger';

const errorResponse = (message, code, status = 500) =>
  NextResponse.json({ success: false, error: message, code }, { status });

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function generateUserId() {
  return crypto.randomBytes(21).toString('base64url');
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail(body.email);
    const password = String(body.password || '');
    const displayName = String(body.displayName || '').trim().slice(0, 160);

    if (!email || !isValidEmail(email)) {
      return errorResponse('A valid email address is required.', 'INVALID_EMAIL', 400);
    }

    if (!isStrongPassword(password)) {
      return errorResponse(
        'Password must be at least 8 characters and include an uppercase letter, a number, and a symbol.',
        'WEAK_PASSWORD',
        400
      );
    }

    const existing = await authRepository.getUserProfileByEmail(email);
    if (existing) {
      return errorResponse('An account with this email already exists.', 'EMAIL_IN_USE', 409);
    }

    const userId = generateUserId();
    const passwordHash = await hashPassword(password);

    const profile = await authRepository.createUserProfile({
      userId,
      email,
      displayName,
      signInProvider: 'password',
      passwordHash,
      passwordAlgo: 'bcrypt',
      emailVerified: false,
      authMigrated: true
    });

    const session = await issueSession(profile);

    sendVerificationEmailV2({ uid: userId, email, displayName }).catch((error) => {
      logger.warn('Failed to dispatch registration verification email', { userId, error: error.message });
    });

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
    logger.error('Registration failed', error);
    return errorResponse('Failed to create account.', 'REGISTRATION_FAILED', 500);
  }
}
