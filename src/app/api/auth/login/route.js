export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import authRepository from '@/lib/db/auth-repository.cjs';
import { verifyPassword, hashPassword } from '@/lib/auth/password';
import { issueSession } from '@/lib/auth/session';
import { verifyFirebasePassword } from '@/lib/auth/firebase-password-bridge';
import { getAdminFirestore } from '@/lib/firebase-admin';
import logger from '@/lib/logger';

const errorResponse = (message, code, status = 500) =>
  NextResponse.json({ success: false, error: message, code }, { status });

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function respondWithSession(profile, session) {
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
}

// Lazy migration: this account has no Postgres credential yet, but the
// password just checked out against Firebase Auth. Provision the Postgres
// profile now, using the SAME uid Firebase already assigned -- every other
// table (kyc_submissions.user_id, listing_reports.reporter_user_id, etc.)
// is already keyed on this string, so preserving it avoids an FK rewrite.
// From this point on the account logs in via Postgres; Firebase is never
// consulted again for it.
async function migrateFirebaseUserToPostgres({ uid, email, password, request }) {
  const db = getAdminFirestore();
  const legacyDoc = await db.collection('users').doc(uid).get();
  const legacyData = legacyDoc.exists ? legacyDoc.data() || {} : {};

  const passwordHash = await hashPassword(password);

  const profile = await authRepository.createUserProfile({
    userId: uid,
    email,
    displayName: legacyData.displayName || '',
    photoUrl: legacyData.photoURL || null,
    signInProvider: 'password',
    passwordHash,
    passwordAlgo: 'bcrypt',
    emailVerified: Boolean(legacyData.emailVerified),
    authMigrated: true
  });

  if (legacyData.phoneNumber || legacyData.location || legacyData.bio || legacyData.role || legacyData.isAdmin || legacyData.kycStatus) {
    await authRepository.updateProfileFields(uid, {
      phoneNumber: legacyData.phoneNumber || null,
      location: legacyData.location || null,
      bio: legacyData.bio || null,
      role: legacyData.role || 'user',
      isAdmin: legacyData.isAdmin === true,
      kycStatus: legacyData.kycStatus || 'unverified'
    });
  }

  logger.info('Lazily migrated Firebase user to Postgres auth', { uid, email });

  const finalProfile = await authRepository.getUserProfileById(uid);
  const userAgent = request.headers.get('user-agent') || null;
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  const session = await issueSession(finalProfile, { userAgent, ipAddress });
  return { profile: finalProfile, session };
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

    // No Postgres credential for this email at all -- try the Firebase
    // lazy-migration path before giving up. (If a Postgres row exists but
    // the password is simply wrong, skip straight to failure below --
    // Firebase wouldn't have a matching password for an already-migrated
    // or newly-registered account either.)
    if (!credentials || !credentials.password_hash) {
      const firebaseUser = await verifyFirebasePassword(email, password);
      if (firebaseUser) {
        const { profile, session } = await migrateFirebaseUserToPostgres({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          password,
          request
        });
        return respondWithSession(profile, session);
      }

      // Same generic message whether the account doesn't exist anywhere,
      // has no password set yet (Google-only account), or Firebase
      // rejected it too -- don't leak which case this is.
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

    return respondWithSession(profile, session);
  } catch (error) {
    logger.error('Login failed', error);
    return errorResponse('Failed to log in.', 'LOGIN_FAILED', 500);
  }
}
