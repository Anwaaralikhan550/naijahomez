export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import authRepository from '@/lib/db/auth-repository.cjs';
import { hashRefreshToken } from '@/lib/auth/tokens';
import logger from '@/lib/logger';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const refreshToken = String(body.refreshToken || '');

    if (refreshToken) {
      await authRepository.revokeRefreshToken(hashRefreshToken(refreshToken));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Logout failed', error);
    // Logout should never block the client from clearing its local session.
    return NextResponse.json({ success: true });
  }
}
