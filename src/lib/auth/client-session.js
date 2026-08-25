'use client';
// Client-side session/token storage for the Postgres-native auth system.
// localStorage (not sessionStorage) to match the "stay logged in across
// tabs/restarts" behavior users already had with the Firebase SDK. httpOnly
// cookies would be more XSS-resistant but need a bigger backend change
// (session storage + CSRF handling) -- noted as a fast-follow, not a
// blocker, in the migration plan.

const STORAGE_KEY = 'naijahomz_session_v1';

function readStorage() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStorage(session) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Storage unavailable (private browsing etc) -- session just won't persist.
  }
}

export function getStoredSession() {
  return readStorage();
}

export function setStoredSession({ accessToken, refreshToken, expiresAt }) {
  writeStorage({ accessToken, refreshToken, expiresAt });
}

export function clearStoredSession() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}

// The access token carries its own expiry, so read it from the token instead of
// trusting the stored value. Sessions created before the server was fixed hold
// the refresh token's 30-day expiry in `expiresAt`, which made this module skip
// refreshing until long after the 1-hour access token had died. Reading `exp`
// repairs those sessions on the next page load rather than at next login.
//
// The signature is not checked here, and does not need to be: this only decides
// *when* to refresh. The server verifies the token on every request.
function decodeTokenExpiry(token) {
  try {
    const payloadSegment = String(token || '').split('.')[1];
    if (!payloadSegment) return 0;

    const base64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const claims = JSON.parse(atob(padded));

    return Number.isFinite(claims?.exp) ? claims.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

let refreshInFlight = null;

async function refreshSession(refreshToken) {
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.success) {
    // Refresh tokens rotate, so a second tab refreshing at the same moment
    // presents a token the server has just revoked. localStorage is shared, so
    // before treating this as signed out, check whether the other tab already
    // stored a working session.
    const current = readStorage();
    if (current?.refreshToken && current.refreshToken !== refreshToken) {
      return current;
    }

    clearStoredSession();
    return null;
  }

  const session = {
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    expiresAt: payload.expiresAt
  };
  writeStorage(session);
  return session;
}

// Replaces `auth.currentUser.getIdToken()` everywhere in the app. Returns
// null if there is no session or it could not be refreshed (caller should
// treat that the same as "signed out").
export async function getValidAccessToken({ forceRefresh = false } = {}) {
  const session = readStorage();
  if (!session?.accessToken) return null;

  const tokenExpiry = decodeTokenExpiry(session.accessToken);
  const storedExpiry = session.expiresAt ? new Date(session.expiresAt).getTime() : 0;
  // Prefer the token's own claim; fall back to the stored value only when the
  // token cannot be parsed.
  const expiresAt = tokenExpiry || storedExpiry;
  const isExpiringSoon = !expiresAt || expiresAt - Date.now() < 60 * 1000;

  if (!forceRefresh && !isExpiringSoon) {
    return session.accessToken;
  }

  if (!session.refreshToken) {
    clearStoredSession();
    return null;
  }

  // De-dupe concurrent refresh calls (multiple components mounting at once).
  if (!refreshInFlight) {
    refreshInFlight = refreshSession(session.refreshToken).finally(() => {
      refreshInFlight = null;
    });
  }

  const refreshed = await refreshInFlight;
  return refreshed?.accessToken || null;
}

export async function signOutSession() {
  const session = readStorage();
  clearStoredSession();
  if (session?.refreshToken) {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken })
    }).catch(() => {});
  }
}
