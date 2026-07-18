export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import authRepository from '@/lib/db/auth-repository.cjs';
import { signAccessToken, generateRefreshTokenValue, hashRefreshToken, refreshTokenExpiry } from '@/lib/auth/tokens';
import logger from '@/lib/logger';

const errorResponse = (message, code, status = 500) =>
  NextResponse.json({ success: false, error: message, code }, { status });

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const refreshToken = String(body.refreshToken || '');

    if (!refreshToken) {
      return errorResponse('refreshToken is required.', 'REFRESH_TOKEN_REQUIRED', 400);
    }

    const oldHash = hashRefreshToken(refreshToken);
    const newRefreshTokenValue = generateRefreshTokenValue();
    const newHash = hashRefreshToken(newRefreshTokenValue);
    const newExpiresAt = refreshTokenExpiry();

    // Rotation: the old token is atomically revoked and replaced. If it was
    // already used (reuse of a rotated-out token, or expired/revoked), this
    // returns null -- treated as a full re-authentication requirement, since
    // token reuse is a signal the refresh token may have been compromised.
    const userId = await authRepository.rotateRefreshToken(oldHash, newHash, newExpiresAt);
    if (!userId) {
      return errorResponse('Refresh token is invalid or expired. Please log in again.', 'REFRESH_TOKEN_INVALID', 401);
    }

    const profile = await authRepository.getUserProfileById(userId);
    if (!profile) {
      return errorResponse('Account not found.', 'ACCOUNT_NOT_FOUND', 404);
    }

    const accessToken = await signAccessToken({
      uid: profile.userId,
      email: profile.email,
      emailVerified: profile.emailVerified,
      isAdmin: profile.isAdmin,
      role: profile.role
    });

    return NextResponse.json({
      success: true,
      accessToken,
      refreshToken: newRefreshTokenValue,
      expiresAt: newExpiresAt
    });
  } catch (error) {
    logger.error('Token refresh failed', error);
    return errorResponse('Failed to refresh session.', 'REFRESH_FAILED', 500);
  }
}
