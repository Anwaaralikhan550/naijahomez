export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { verifyEmailToken } from '@/lib/email/verification-service';
import { getAdminAuth } from '@/lib/firebase-admin';

function getAppBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

function buildRedirect(status, message) {
  const url = new URL('/verify-email', getAppBaseUrl());
  url.searchParams.set('status', status);
  if (message) {
    url.searchParams.set('message', message);
  }
  return url.toString();
}

function isValidUid(uid) {
  if (typeof uid !== 'string') return false;
  const value = uid.trim();
  return value.length >= 6 && value.length <= 128 && !/\s/.test(value);
}

function isValidToken(token) {
  if (typeof token !== 'string') return false;
  const value = token.trim();
  return /^[a-f0-9]{32,128}$/i.test(value);
}

async function processVerification(uid, token) {
  if (!uid || !token) {
    return {
      ok: false,
      status: 400,
      payload: { error: 'uid and token are required', code: 'MISSING_VERIFICATION_PARAMS' }
    };
  }

  if (!isValidUid(uid)) {
    return {
      ok: false,
      status: 400,
      payload: { error: 'Invalid verification uid', code: 'INVALID_UID' }
    };
  }

  if (!isValidToken(token)) {
    return {
      ok: false,
      status: 400,
      payload: { error: 'Invalid verification token format', code: 'INVALID_TOKEN_FORMAT' }
    };
  }

  const adminAuth = getAdminAuth();
  let userRecord;
  try {
    userRecord = await adminAuth.getUser(uid);
  } catch (error) {
    if (error?.code === 'auth/user-not-found') {
      return {
        ok: false,
        status: 404,
        payload: { error: 'Verification user not found', code: 'USER_NOT_FOUND' }
      };
    }
    throw error;
  }

  if (userRecord?.emailVerified) {
    return {
      ok: true,
      status: 200,
      payload: { success: true, message: 'Email already verified', code: 'ALREADY_VERIFIED' }
    };
  }

  const result = await verifyEmailToken({ uid, token });
  if (!result.success) {
    const status = result.code === 'TOKEN_EXPIRED' ? 410 : 400;
    return {
      ok: false,
      status,
      payload: { error: result.message, code: result.code }
    };
  }

  return {
    ok: true,
    status: 200,
    payload: { success: true, message: 'Email verified successfully', code: 'EMAIL_VERIFIED' }
  };
}

function prefersHtml(request) {
  const accept = request.headers.get('accept') || '';
  return accept.includes('text/html');
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const uid = searchParams.get('uid');
    const token = searchParams.get('token');

    const result = await processVerification(uid, token);

    if (prefersHtml(request)) {
      if (result.ok) {
        return NextResponse.redirect(buildRedirect('verified', 'Email verified successfully'));
      }
      return NextResponse.redirect(buildRedirect('error', result.payload.error || 'Verification failed'));
    }

    return NextResponse.json(result.payload, { status: result.status });
  } catch (error) {
    logger.error('Email verification GET endpoint failed', error);
    return NextResponse.json(
      { error: 'Failed to verify email', code: 'VERIFY_EMAIL_FAILED' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const uid = body?.uid;
    const token = body?.token;

    const result = await processVerification(uid, token);
    return NextResponse.json(result.payload, { status: result.status });
  } catch (error) {
    logger.error('Email verification POST endpoint failed', error);
    return NextResponse.json(
      { error: 'Failed to verify email', code: 'VERIFY_EMAIL_FAILED' },
      { status: 500 }
    );
  }
}
