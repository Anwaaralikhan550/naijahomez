export const dynamic = 'force-dynamic';
import crypto from 'crypto';
import { NextResponse } from 'next/server';
import authRepository from '@/lib/db/auth-repository.cjs';
import { issueSession } from '@/lib/auth/session';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import logger from '@/lib/logger';

const STATE_COOKIE = 'g_oauth_state';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo';

function getAppBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

function getRedirectUri() {
  return process.env.GOOGLE_OAUTH_REDIRECT_URI || `${getAppBaseUrl()}/api/auth/google/callback`;
}

function failureRedirect(reason) {
  return NextResponse.redirect(`${getAppBaseUrl()}/login?error=google_auth_failed&reason=${encodeURIComponent(reason)}`);
}

function generateUserId() {
  return crypto.randomBytes(21).toString('base64url');
}

// If this email already has a Firebase Auth account (the common case for
// any existing user, since Google sign-in previously always went through
// Firebase), reuse that uid instead of minting a new one -- otherwise their
// existing listings/KYC/messages (all keyed on the Firebase uid) would
// become invisible under a brand-new identity.
async function resolveUserId(email) {
  try {
    const existingFirebaseUser = await getAdminAuth().getUserByEmail(email);
    if (existingFirebaseUser?.uid) return existingFirebaseUser.uid;
  } catch {
    // auth/user-not-found is the expected case for genuinely new users.
  }
  return generateUserId();
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      return failureRedirect(errorParam);
    }

    const stateCookie = request.cookies.get(STATE_COOKIE)?.value;
    if (!code || !state || !stateCookie || state !== stateCookie) {
      return failureRedirect('invalid_state');
    }

    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return failureRedirect('not_configured');
    }

    const tokenResponse = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: getRedirectUri(),
        grant_type: 'authorization_code'
      })
    });

    if (!tokenResponse.ok) {
      logger.warn('Google token exchange failed', { status: tokenResponse.status });
      return failureRedirect('token_exchange_failed');
    }

    const tokenPayload = await tokenResponse.json();

    const userInfoResponse = await fetch(USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${tokenPayload.access_token}` }
    });

    if (!userInfoResponse.ok) {
      logger.warn('Google userinfo fetch failed', { status: userInfoResponse.status });
      return failureRedirect('userinfo_failed');
    }

    const googleUser = await userInfoResponse.json();
    const email = String(googleUser.email || '').trim().toLowerCase();

    if (!email || !googleUser.email_verified) {
      return failureRedirect('email_not_verified');
    }

    let profile = await authRepository.getUserProfileByEmail(email);

    if (!profile) {
      const userId = await resolveUserId(email);
      const legacyDoc = await getAdminFirestore().collection('users').doc(userId).get();
      const legacyData = legacyDoc.exists ? legacyDoc.data() || {} : {};

      profile = await authRepository.createUserProfile({
        userId,
        email,
        displayName: googleUser.name || legacyData.displayName || '',
        photoUrl: googleUser.picture || legacyData.photoURL || null,
        signInProvider: 'google',
        emailVerified: true,
        authMigrated: true
      });

      if (legacyData.phoneNumber || legacyData.location || legacyData.bio || legacyData.role || legacyData.isAdmin || legacyData.kycStatus) {
        await authRepository.updateProfileFields(userId, {
          phoneNumber: legacyData.phoneNumber || null,
          location: legacyData.location || null,
          bio: legacyData.bio || null,
          role: legacyData.role || 'user',
          isAdmin: legacyData.isAdmin === true,
          kycStatus: legacyData.kycStatus || 'unverified'
        });
        profile = await authRepository.getUserProfileById(userId);
      }
    } else if (!profile.emailVerified) {
      // Google already verified this email; reflect that on the profile.
      await authRepository.setEmailVerified(profile.userId, true);
      profile = await authRepository.getUserProfileById(profile.userId);
    }

    const session = await issueSession(profile);

    // Tokens travel in the URL fragment, not the query string, so they
    // never reach server access logs -- only client-side JS on the landing
    // page can read window.location.hash.
    const fragment = new URLSearchParams({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt.toISOString()
    }).toString();

    const response = NextResponse.redirect(`${getAppBaseUrl()}/auth/complete#${fragment}`);
    response.cookies.delete(STATE_COOKIE);
    return response;
  } catch (error) {
    logger.error('Google OAuth callback failed', error);
    return failureRedirect('server_error');
  }
}
