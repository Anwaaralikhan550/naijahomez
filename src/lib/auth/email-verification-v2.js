// Self-contained email verification for the new Postgres-native auth system.
// Deliberately independent of src/lib/email/verification-service.js, which
// is coupled to Firebase Admin Auth's getUser()/updateUser() -- calls that
// fail outright for users created through this system, since they don't
// exist in Firebase Auth at all. Reuses the same emailVerificationTokens
// storage (still shim-backed) and the existing SMTP pipeline.
import crypto from 'crypto';
import { getAdminFirestore } from '@/lib/firebase-admin';
import logger from '@/lib/logger';
import { sendMail } from '@/lib/email/mailer';
import { buildVerificationEmailTemplate } from '@/lib/templates/verificationEmail';
import authRepository from '@/lib/db/auth-repository.cjs';

const TOKEN_TTL_HOURS = 24;
const TOKEN_COLLECTION = 'emailVerificationTokensV2';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getAppBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

export async function sendVerificationEmailV2({ uid, email, displayName = '' }) {
  const db = getAdminFirestore();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TOKEN_TTL_HOURS * 60 * 60 * 1000);

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
  const verificationLink = `${baseUrl}/api/auth/verify-email-v2?token=${encodeURIComponent(rawToken)}&uid=${encodeURIComponent(uid)}`;
  const template = buildVerificationEmailTemplate({ displayName, verificationUrl: verificationLink, expiresInHours: TOKEN_TTL_HOURS });

  try {
    await sendMail({ to: email, subject: 'Verify your NaijaHomz email', html: template.html, text: template.text });
    return { success: true };
  } catch (error) {
    logger.error('Failed to send v2 verification email', error, { uid, email });
    return { success: false, error: error.message };
  }
}

export async function verifyEmailTokenV2({ uid, token }) {
  if (!uid || !token) return { success: false, code: 'INVALID_REQUEST' };

  const db = getAdminFirestore();
  const tokenHash = hashToken(token);

  const snapshot = await db.collection(TOKEN_COLLECTION)
    .where('uid', '==', uid)
    .where('tokenHash', '==', tokenHash)
    .where('used', '==', false)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return { success: false, code: 'INVALID_TOKEN' };
  }

  const tokenDoc = snapshot.docs[0];
  const data = tokenDoc.data();
  const expiresAtDate = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);

  if (!expiresAtDate || expiresAtDate.getTime() < Date.now()) {
    await tokenDoc.ref.update({ used: true, usedAt: new Date(), invalidReason: 'expired' });
    return { success: false, code: 'TOKEN_EXPIRED' };
  }

  await authRepository.setEmailVerified(uid, true);
  await tokenDoc.ref.update({ used: true, usedAt: new Date() });

  return { success: true };
}
