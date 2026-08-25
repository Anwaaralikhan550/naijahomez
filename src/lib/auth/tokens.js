import crypto from 'crypto';
import { SignJWT, jwtVerify } from 'jose';

const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const ACCESS_TOKEN_TTL = `${ACCESS_TOKEN_TTL_MS / 1000}s`;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

let cachedSecretKey = null;

function getSecretKey() {
  if (cachedSecretKey) return cachedSecretKey;

  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_JWT_SECRET is not configured (must be set, 32+ characters).');
  }

  cachedSecretKey = new TextEncoder().encode(secret);
  return cachedSecretKey;
}

// Access token payload mirrors what src/lib/auth-middleware.js's verifyAuth()
// already returns from a decoded Firebase ID token, so downstream code
// (97 call sites) doesn't need to change -- only how the token is verified.
export async function signAccessToken({ uid, email, emailVerified, isAdmin, role }) {
  return new SignJWT({
    email: email || null,
    emailVerified: Boolean(emailVerified),
    admin: Boolean(isAdmin),
    role: role || 'user'
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(uid)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(getSecretKey());
}

export async function verifyAccessToken(token) {
  const { payload } = await jwtVerify(token, getSecretKey());
  return {
    uid: payload.sub,
    email: payload.email || null,
    emailVerified: Boolean(payload.emailVerified),
    isAdmin: Boolean(payload.admin),
    role: payload.role || 'user'
  };
}

// Refresh tokens are opaque random values handed to the client; only their
// SHA-256 hash is stored server-side (same pattern as the existing email
// verification / password-reset token design in this codebase).
export function generateRefreshTokenValue() {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashRefreshToken(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function refreshTokenExpiry() {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
}

// The client uses this to decide when to refresh. It must be the ACCESS token's
// expiry: handing it the refresh token's 30-day expiry made the client believe
// the access token was good for a month, so it never refreshed and every call
// started 401ing an hour after login.
export function accessTokenExpiry() {
  return new Date(Date.now() + ACCESS_TOKEN_TTL_MS);
}

export { ACCESS_TOKEN_TTL_MS, REFRESH_TOKEN_TTL_MS };
