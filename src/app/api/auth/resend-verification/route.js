export const dynamic = 'force-dynamic';
import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import logger from '@/lib/logger';
import { buildVerificationEmailTemplate } from '@/lib/templates/verificationEmail';
import { sendVerificationEmailWithFallback } from '@/lib/mail';

const TOKEN_TTL_HOURS = 24;
const TOKEN_COLLECTION = 'emailVerificationTokens';
const RATE_LIMIT_COLLECTION = 'emailVerificationRateLimits';
const RESEND_INTERVAL_SECONDS = 60;

const errorResponse = (message, code, status = 500, extra = {}) =>
  NextResponse.json({ success: false, error: message, code, ...extra }, { status });

const authErrorResponse = async (authError) => {
  const status = authError?.status || 401;
  const payload = await authError?.clone?.().json?.().catch(() => ({}));
  const message = payload?.error || 'Authentication required';
  const code = status === 403 ? 'FORBIDDEN' : status === 503 ? 'AUTH_SERVICE_UNAVAILABLE' : 'UNAUTHORIZED';
  return errorResponse(message, code, status);
};

function getAppBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function revokeOpenTokens(db, uid) {
  const snapshot = await db
    .collection(TOKEN_COLLECTION)
    .where('uid', '==', uid)
    .where('used', '==', false)
    .get();

  if (snapshot.empty) return;

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.update(doc.ref, {
      used: true,
      revokedAt: new Date(),
      revokedReason: 'resend_requested'
    });
  });
  await batch.commit();
}

async function enforceResendRateLimit(db, uid) {
  const docRef = db.collection(RATE_LIMIT_COLLECTION).doc(uid);
  const snap = await docRef.get();
  const now = Date.now();

  const lastRequestedAt = snap.exists
    ? (() => {
        const value = snap.data()?.lastRequestedAt;
        if (!value) return 0;
        if (value?.toDate) return value.toDate().getTime();
        return new Date(value).getTime() || 0;
      })()
    : 0;

  const elapsedMs = now - lastRequestedAt;
  if (elapsedMs < RESEND_INTERVAL_SECONDS * 1000) {
    const retryAfter = Math.ceil((RESEND_INTERVAL_SECONDS * 1000 - elapsedMs) / 1000);
    return { allowed: false, retryAfter };
  }

  await docRef.set(
    {
      uid,
      lastRequestedAt: new Date(),
      updatedAt: new Date()
    },
    { merge: true }
  );

  return { allowed: true, retryAfter: 0 };
}

export async function POST(request) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authErrorResponse(authResult.error);
    }

    const db = getAdminFirestore();
    const rateLimit = await enforceResendRateLimit(db, authResult.userId);
    if (!rateLimit.allowed) {
      return errorResponse(
        'Please wait before requesting another verification email',
        'RATE_LIMITED',
        429,
        { retryAfterSeconds: rateLimit.retryAfter }
      );
    }

    const adminAuth = getAdminAuth();
    const userRecord = await adminAuth.getUser(authResult.userId);
    if (!userRecord?.email) {
      return errorResponse('User email not found', 'USER_EMAIL_NOT_FOUND', 404);
    }

    if (userRecord.emailVerified) {
      return NextResponse.json({
        success: true,
        message: 'Email is already verified',
        code: 'ALREADY_VERIFIED'
      });
    }

    await revokeOpenTokens(db, authResult.userId);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TOKEN_TTL_HOURS * 60 * 60 * 1000);

    await db.collection(TOKEN_COLLECTION).add({
      uid: authResult.userId,
      email: userRecord.email,
      tokenHash,
      used: false,
      createdAt: now,
      expiresAt
    });

    const verificationUrl = `${getAppBaseUrl()}/api/auth/verify-email?token=${encodeURIComponent(rawToken)}&uid=${encodeURIComponent(authResult.userId)}`;
    const emailTemplate = buildVerificationEmailTemplate({
      displayName: authResult.user?.name || userRecord.displayName || '',
      verificationUrl,
      expiresInHours: TOKEN_TTL_HOURS
    });

    const sendResult = await sendVerificationEmailWithFallback({
      to: userRecord.email,
      subject: 'Verify your NaijaHomz email',
      html: emailTemplate.html,
      text: emailTemplate.text,
      verificationUrl,
      uid: authResult.userId,
      metadata: {
        trigger: 'resend-verification',
        expiresAt: expiresAt.toISOString()
      }
    });

    if (!sendResult.success) {
      return NextResponse.json(
        {
          success: false,
          code: sendResult.reasonCode,
          error: 'Email provider unavailable. Verification link saved for manual testing.',
          manualFallback: {
            mailLogId: sendResult.mailLogId,
            fallbackStored: sendResult.fallbackStored
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
    logger.error('Resend verification endpoint failed', error);
    return errorResponse('Failed to resend verification email', 'RESEND_VERIFICATION_FAILED', 500);
  }
}

