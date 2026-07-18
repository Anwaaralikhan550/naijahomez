// Lazy-migration bridge: lets /api/auth/login verify a password against an
// existing Firebase Auth account without needing the Firebase client SDK.
// Firebase Admin SDK deliberately has no "verify a password" call (it can
// only verify already-issued ID tokens) -- the only way to check a password
// server-side is Firebase's own Identity Toolkit REST API, the same
// endpoint the client SDK's signInWithEmailAndPassword calls under the hood.
//
// This is a temporary bridge for the dual-auth transition window (Phase 6).
// Once burn-in is complete and Firebase is decommissioned, this file goes
// away along with the rest of the Firebase Admin/client SDK usage.
import logger from '@/lib/logger';

const SIGN_IN_ENDPOINT = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword';

// Returns { uid, email, emailVerified } on success, or null if the
// password is wrong / account doesn't exist / API is unreachable.
export async function verifyFirebasePassword(email, password) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    logger.warn('verifyFirebasePassword: NEXT_PUBLIC_FIREBASE_API_KEY not configured');
    return null;
  }

  try {
    const response = await fetch(`${SIGN_IN_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true })
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok || !payload?.localId) {
      // Expected failures (INVALID_PASSWORD, EMAIL_NOT_FOUND, etc.) are not
      // logged as errors -- this is the normal "not a legacy Firebase user
      // either" path for most login attempts once migration is underway.
      return null;
    }

    return {
      uid: payload.localId,
      email: payload.email || email,
      emailVerified: Boolean(payload.emailVerified)
    };
  } catch (error) {
    logger.error('verifyFirebasePassword request failed', error);
    return null;
  }
}
