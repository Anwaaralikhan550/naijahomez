// Shared helpers for issuing a login session (access + refresh token pair)
// and keeping the legacy Firestore-shim `users` doc in sync, since every
// other feature (profile display, KYC, hub, isAdmin fallback) still reads
// user data from there. This is an additive write, not a replacement --
// app_user_profiles (Postgres) is the source of truth for the new auth
// system; the shim doc is a denormalized mirror kept for backward
// compatibility during the migration.
import { getAdminFirestore } from '@/lib/firebase-admin';
import { signAccessToken, generateRefreshTokenValue, hashRefreshToken, refreshTokenExpiry } from '@/lib/auth/tokens';
import authRepository from '@/lib/db/auth-repository.cjs';

export async function syncLegacyUserDoc(profile) {
  const db = getAdminFirestore();
  const userRef = db.collection('users').doc(profile.userId);
  const existing = await userRef.get();
  const now = new Date();

  const patch = {
    email: profile.email || '',
    displayName: profile.displayName || '',
    photoURL: profile.photoUrl || '',
    emailVerified: Boolean(profile.emailVerified),
    signInProvider: profile.signInProvider || 'password',
    role: profile.role || 'user',
    isAdmin: profile.isAdmin === true,
    kycStatus: profile.kycStatus || 'unverified',
    updatedAt: now
  };

  if (!existing.exists) {
    await userRef.set({ ...patch, createdAt: now });
  } else {
    await userRef.set(patch, { merge: true });
  }
}

export async function issueSession(profile, { userAgent = null, ipAddress = null } = {}) {
  const accessToken = await signAccessToken({
    uid: profile.userId,
    email: profile.email,
    emailVerified: profile.emailVerified,
    isAdmin: profile.isAdmin,
    role: profile.role
  });

  const refreshTokenValue = generateRefreshTokenValue();
  const refreshTokenHash = hashRefreshToken(refreshTokenValue);
  const expiresAt = refreshTokenExpiry();

  await authRepository.createRefreshToken(profile.userId, refreshTokenHash, expiresAt, { userAgent, ipAddress });
  await syncLegacyUserDoc(profile).catch(() => {
    // Best-effort mirror sync -- profile display may lag by one request if
    // this fails, but the auth session itself is already valid.
  });

  return { accessToken, refreshToken: refreshTokenValue, expiresAt };
}
