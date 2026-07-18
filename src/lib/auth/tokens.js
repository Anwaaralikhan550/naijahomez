import crypto from 'crypto';
import { SignJWT, jwtVerify } from 'jose';

const ACCESS_TOKEN_TTL = '1h';
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

export { REFRESH_TOKEN_TTL_MS };
