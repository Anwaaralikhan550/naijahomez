import crypto from 'crypto';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import logger from '@/lib/logger';
import { sendVerificationEmailWithFallback } from '@/lib/mail';
import { buildVerificationEmailTemplate } from '@/lib/templates/verificationEmail';
import authRepository from '@/lib/db/auth-repository.cjs';

const TOKEN_TTL_HOURS = 24;
const TOKEN_COLLECTION = 'emailVerificationTokens';

function getAppBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function markExistingTokensRevoked(db, uid) {
  const existing = await db
    .collection(TOKEN_COLLECTION)
    .where('uid', '==', uid)
    .where('used', '==', false)
    .get();

  if (existing.empty) {
    return;
  }

  const batch = db.batch();
  existing.docs.forEach((doc) => {
    batch.update(doc.ref, {
      used: true,
      revokedAt: new Date(),
      revokedReason: 'new_token_issued'
    });
  });
  await batch.commit();
}

export async function sendVerificationEmailForUser({ uid, email, displayName = '' }) {
  try {
    if (!uid || !email) {
      throw new Error('uid and email are required for verification email');
    }

    const db = getAdminFirestore();
    const auth = getAdminAuth();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TOKEN_TTL_HOURS * 60 * 60 * 1000);

    const userRecord = await auth.getUser(uid);
    if (!userRecord || userRecord.email !== email) {
      throw new Error('Authenticated user does not match requested email');
    }

    if (userRecord.emailVerified) {
      return { alreadyVerified: true };
    }

    await markExistingTokensRevoked(db, uid);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    await db.collection(TOKEN_COLLECTION).add({
      uid,
      email,
      tokenHash,
      used: false,
      createdAt: now,
      expiresAt
    });

    const baseUrl = getAppBaseUrl();
    const verificationLink = `${baseUrl}/api/auth/verify-email?token=${encodeURIComponent(rawToken)}&uid=${encodeURIComponent(uid)}`;

    const emailTemplate = buildVerificationEmailTemplate({
      displayName,
      verificationUrl: verificationLink,
      expiresInHours: TOKEN_TTL_HOURS
    });

    const sendResult = await sendVerificationEmailWithFallback({
      to: email,
      subject: 'Verify your NaijaHomz email',
      html: emailTemplate.html,
      text: emailTemplate.text,
      verificationUrl: verificationLink,
      uid,
      metadata: {
        trigger: 'send-verification',
        expiresAt: expiresAt.toISOString()
      }
    });

    if (!sendResult.success) {
      logger.warn('Verification email provider unavailable; fallback used', {
        uid,
        email,
        reasonCode: sendResult.reasonCode,
        mailLogId: sendResult.mailLogId
      });
      return {
        success: false,
        expiresAt,
        reasonCode: sendResult.reasonCode,
        reasonMessage: sendResult.reasonMessage,
        fallbackStored: sendResult.fallbackStored,
        mailLogId: sendResult.mailLogId
      };
    }

    logger.info('Verification email dispatched', { uid, email, messageId: sendResult.messageId });
    return { success: true, expiresAt, messageId: sendResult.messageId };
  } catch (error) {
    logger.error('Failed to send verification email', error, { uid, email });
    throw error;
  }
}

export async function verifyEmailToken({ uid, token }) {
  try {
    if (!uid || !token) {
      throw new Error('uid and token are required');
    }

    const db = getAdminFirestore();
    const auth = getAdminAuth();
    const tokenHash = hashToken(token);

    const snapshot = await db
      .collection(TOKEN_COLLECTION)
      .where('uid', '==', uid)
      .where('tokenHash', '==', tokenHash)
      .where('used', '==', false)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return { success: false, code: 'INVALID_TOKEN', message: 'Invalid or already used verification token' };
    }

    const tokenDoc = snapshot.docs[0];
    const tokenData = tokenDoc.data();
    const expiresAtDate = tokenData.expiresAt?.toDate ? tokenData.expiresAt.toDate() : new Date(tokenData.expiresAt);

    if (!expiresAtDate || expiresAtDate.getTime() < Date.now()) {
      await tokenDoc.ref.update({
        used: true,
        usedAt: new Date(),
        invalidReason: 'expired'
      });
      return { success: false, code: 'TOKEN_EXPIRED', message: 'Verification token has expired' };
    }

    await auth.updateUser(uid, { emailVerified: true });

    await db.collection('users').doc(uid).set(
      {
        emailVerified: true,
        verifiedAt: new Date(),
        updatedAt: new Date()
      },
      { merge: true }
    );

    // Best-effort forward-compat sync: no-op until this user has an
    // app_user_profiles row (created during the Phase 6 auth migration).
    await authRepository.setEmailVerified(uid, true).catch(() => {});

    await tokenDoc.ref.update({
      used: true,
      usedAt: new Date()
    });

    logger.info('Email verification completed', { uid });
    return { success: true };
  } catch (error) {
    logger.error('Email verification token handling failed', error, { uid });
    throw error;
  }
}
