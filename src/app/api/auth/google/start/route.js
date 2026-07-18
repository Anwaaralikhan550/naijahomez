export const dynamic = 'force-dynamic';
import crypto from 'crypto';
import { NextResponse } from 'next/server';

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const STATE_COOKIE = 'g_oauth_state';

function getRedirectUri() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return process.env.GOOGLE_OAUTH_REDIRECT_URI || `${baseUrl}/api/auth/google/callback`;
}

export async function GET() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ success: false, error: 'Google sign-in is not configured.' }, { status: 503 });
  }

  const state = crypto.randomBytes(24).toString('base64url');
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account'
  });

  const response = NextResponse.redirect(`${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/'
  });
  return response;
}
