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

let refreshInFlight = null;

async function refreshSession(refreshToken) {
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.success) {
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
export async function getValidAccessToken() {
  const session = readStorage();
  if (!session?.accessToken) return null;

  const expiresAt = session.expiresAt ? new Date(session.expiresAt).getTime() : 0;
  const isExpiringSoon = !expiresAt || expiresAt - Date.now() < 60 * 1000;

  if (!isExpiringSoon) {
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
