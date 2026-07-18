'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import {
  getStoredSession,
  setStoredSession,
  getValidAccessToken,
  signOutSession
} from '@/lib/auth/client-session';

const AuthContext = createContext({});
const STRONG_PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const isStrongPassword = (password) => STRONG_PASSWORD_REGEX.test(String(password || ''));

function requiresEmailVerification(signInProvider) {
  return signInProvider === 'password' || signInProvider === 'email';
}

function buildUserFromProfile(profile) {
  return {
    uid: profile.uid,
    email: profile.email || '',
    displayName: profile.displayName || '',
    photoURL: profile.photoURL || '',
    emailVerified: Boolean(profile.emailVerified),
    requiresEmailVerification: requiresEmailVerification(profile.signInProvider),
    signInProvider: profile.signInProvider || 'password',
    phoneNumber: profile.phoneNumber || '',
    location: profile.location || '',
    bio: profile.bio || '',
    kycStatus: profile.kycStatus || 'unverified',
    isAdmin: profile.isAdmin === true,
    role: profile.role || 'user'
  };
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const callProfileEndpoint = async (method = 'GET', body = null) => {
    const token = await getValidAccessToken();
    if (!token) return { success: false, profile: null };

    const response = await fetch('/api/auth/profile', {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${token}`
      },
      body: body ? JSON.stringify(body) : undefined
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.error || 'Failed to load user profile');
    }
    return payload;
  };

  // Bootstrap session on mount: if a stored refresh token can still produce
  // a valid access token, fetch the profile and populate `user`. Replaces
  // Firebase's onAuthStateChanged listener -- there's no push notification
  // for session changes anymore, so this only runs once per page load
  // (signIn/signUp/signOut update `user` directly instead of waiting for
  // a listener to fire).
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const session = getStoredSession();
      if (!session?.accessToken) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const profilePayload = await callProfileEndpoint('GET');
        if (cancelled) return;
        if (profilePayload.success && profilePayload.profile) {
          setUser(buildUserFromProfile(profilePayload.profile));
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Session bootstrap failed:', error);
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const ERROR_MESSAGES = {
    INVALID_CREDENTIALS: 'Invalid email or password. Please try again.',
    ACCOUNT_LOCKED: 'Too many failed attempts. Please try again later or reset your password.',
    INVALID_EMAIL: 'Please enter a valid email address.',
    WEAK_PASSWORD: 'Password must be at least 8 characters and include 1 uppercase letter, 1 number, and 1 special character.',
    EMAIL_IN_USE: 'An account with this email already exists.',
    CREDENTIALS_REQUIRED: 'Please enter your email and password.'
  };

  const friendlyError = (code, fallback) => ERROR_MESSAGES[code] || fallback || 'An error occurred. Please try again.';

  // Sign in with email/password
  const signIn = async (email, password) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.success) {
        return { user: null, error: friendlyError(payload?.code, payload?.error) };
      }

      setStoredSession({
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
        expiresAt: payload.expiresAt
      });

      const nextUser = buildUserFromProfile({ ...payload.user, uid: payload.user.uid });
      setUser(nextUser);
      return { user: nextUser, error: null };
    } catch (error) {
      console.error('Sign in error:', error);
      return { user: null, error: 'Unable to reach the sign-in service. Please try again.' };
    }
  };

  // Sign up with email/password
  const signUp = async (email, password, displayName) => {
    try {
      if (!isStrongPassword(password)) {
        return {
          user: null,
          error: friendlyError('WEAK_PASSWORD'),
          needsVerification: false
        };
      }

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.success) {
        return { user: null, error: friendlyError(payload?.code, payload?.error), needsVerification: false };
      }

      setStoredSession({
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
        expiresAt: payload.expiresAt
      });

      const nextUser = buildUserFromProfile(payload.user);
      setUser(nextUser);
      return { user: nextUser, error: null, needsVerification: true, verificationWarning: null };
    } catch (error) {
      console.error('Sign up error:', error);
      return { user: null, error: 'Unable to reach the registration service. Please try again.', needsVerification: false };
    }
  };

  // Redirects to the Google OAuth flow -- this is a full-page navigation,
  // not a popup, so callers should not expect this promise to resolve with
  // a user. The /auth/complete page picks the flow back up after Google
  // redirects back and calls completeGoogleSession() below.
  const signInWithGoogle = () => {
    window.location.href = '/api/auth/google/start';
    return new Promise(() => {});
  };

  // Called by /auth/complete after a successful Google OAuth round-trip
  // (tokens arrive in the URL fragment, read there, passed in here).
  const completeGoogleSession = async ({ accessToken, refreshToken, expiresAt }) => {
    try {
      setStoredSession({ accessToken, refreshToken, expiresAt });
      const profilePayload = await callProfileEndpoint('GET');
      if (!profilePayload.success || !profilePayload.profile) {
        throw new Error('Failed to load profile after Google sign-in');
      }
      const nextUser = buildUserFromProfile(profilePayload.profile);
      setUser(nextUser);
      return { user: nextUser, error: null };
    } catch (error) {
      console.error('Google session completion error:', error);
      return { user: null, error: error.message };
    }
  };

  // Send/resend email verification
  const sendVerificationEmail = async () => {
    try {
      const token = await getValidAccessToken();
      if (!token) {
        return { error: 'No authenticated user' };
      }

      const response = await fetch('/api/auth/resend-verification-v2', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.success) {
        if (payload?.code === 'RATE_LIMITED') {
          return { error: payload.error, code: payload.code, retryAfterSeconds: payload.retryAfterSeconds || 60 };
        }
        return { error: payload?.error || 'Failed to send verification email' };
      }

      return { error: null, message: payload.message, code: payload.code };
    } catch (error) {
      console.error('Send verification email error:', error);
      return { error: error.message };
    }
  };

  // Reload user to get updated emailVerified status
  const reloadUser = async () => {
    try {
      const profilePayload = await callProfileEndpoint('GET');
      if (!profilePayload.success || !profilePayload.profile) {
        throw new Error('No authenticated user');
      }
      const nextUser = buildUserFromProfile(profilePayload.profile);
      setUser(nextUser);
      return { error: null, emailVerified: nextUser.emailVerified };
    } catch (error) {
      console.error('Reload user error:', error);
      return { error: error.message };
    }
  };

  // Update user profile
  const updateProfile = async (profileData) => {
    try {
      const profilePayload = await callProfileEndpoint('PATCH', profileData);
      const profileResponse = profilePayload.profile || {};

      setUser((prev) => ({
        ...prev,
        ...profileData,
        phoneNumber: profileResponse.phoneNumber || '',
        location: profileResponse.location || '',
        bio: profileResponse.bio || '',
        photoURL: profileResponse.photoURL || profileData.photoURL || '',
        kycStatus: profileResponse.kycStatus || 'unverified'
      }));

      return { error: null };
    } catch (error) {
      console.error('Profile update error:', error);
      return { error: error.message };
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      localStorage.removeItem('hubCurrentCommunity');
      await signOutSession();
      setUser(null);
      return { error: null };
    } catch (error) {
      console.error('Sign out error:', error);
      return { error: error.message };
    }
  };

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    completeGoogleSession,
    updateProfile,
    sendVerificationEmail,
    reloadUser,
    signOut
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
