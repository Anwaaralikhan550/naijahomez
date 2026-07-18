'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile as firebaseUpdateProfile,
  sendEmailVerification,
  reload
} from 'firebase/auth';
import { auth } from '@/lib/firebase-client';

const AuthContext = createContext({});
const STRONG_PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const isStrongPassword = (password) => STRONG_PASSWORD_REGEX.test(String(password || ''));

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Helper function to determine if email verification should be required
  const shouldRequireEmailVerification = (firebaseUser, userData = {}) => {
    const providerId = userData.signInProvider || firebaseUser?.providerData?.[0]?.providerId || 'email';
    return providerId === 'password' || providerId === 'email';
  };

  const callProfileEndpoint = async (method = 'GET', body = null) => {
    if (!auth.currentUser) return { success: false, profile: null };

    const token = await auth.currentUser.getIdToken();
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

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Get additional user data from the app database.
          const profilePayload = await callProfileEndpoint('GET');
          const userData = profilePayload.profile || {};
          
          // Determine effective email verification status
          const requiresVerification = shouldRequireEmailVerification(firebaseUser, userData);
          const effectiveEmailVerified = firebaseUser.emailVerified || !requiresVerification;
          
          const user = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || userData.displayName || '',
            photoURL: firebaseUser.photoURL || userData.photoURL || '',
            emailVerified: effectiveEmailVerified,
            requiresEmailVerification: requiresVerification,
            signInProvider: userData.signInProvider || firebaseUser.providerData[0]?.providerId || 'email',
            phoneNumber: userData.phoneNumber || '',
            location: userData.location || '',
            bio: userData.bio || '',
            kycStatus: userData.kycStatus || 'unverified',
            metadata: firebaseUser.metadata
          };
          
          setUser(user);
          console.log('User authenticated:', user.uid, 'Email verified:', effectiveEmailVerified, 'Requires verification:', requiresVerification);
        } catch (error) {
          console.error('Error fetching user data:', error);
          // Still set basic user info even if Firestore fails
          const requiresVerification = shouldRequireEmailVerification(firebaseUser);
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || '',
            photoURL: firebaseUser.photoURL || '',
            emailVerified: firebaseUser.emailVerified || !requiresVerification,
            requiresEmailVerification: requiresVerification,
            signInProvider: firebaseUser.providerData[0]?.providerId || 'email',
            kycStatus: 'unverified'
          });
        }
      } else {
        // Clear user state and any cached data
        setUser(null);
        console.log('User signed out');
        
        // Clear Hub-related localStorage to prevent stale state issues
        try {
          localStorage.removeItem('hubCurrentCommunity');
        } catch (e) {
          // Ignore localStorage errors in case it's not available
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Map Firebase error codes to user-friendly messages
  const getAuthErrorMessage = (error) => {
    switch (error.code) {
      case 'auth/invalid-login-credentials':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Invalid email or password. Please try again.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/user-disabled':
        return 'This account has been disabled. Please contact support.';
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please try again later.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your connection and try again.';
      case 'auth/email-already-in-use':
        return 'An account with this email already exists.';
      case 'auth/weak-password':
        return 'Password must be at least 8 characters and include 1 uppercase letter, 1 number, and 1 special character.';
      default:
        return 'An error occurred. Please try again.';
    }
  };

  const getVerificationRedirectUrl = () =>
    `${window.location.origin}/verify-email?continueUrl=${encodeURIComponent('/dashboard')}`;

  const callVerificationEndpoint = async (path, body = {}) => {
    if (!auth.currentUser) {
      return { success: false, error: 'No authenticated user', code: 'NO_AUTH_USER' };
    }

    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      const payload = await response.json().catch(() => ({}));
      const message = payload?.message || payload?.error || 'Verification request failed';

      if (!response.ok || payload?.success === false) {
        return {
          success: false,
          error: message,
          code: payload?.code || `HTTP_${response.status}`,
          retryAfterSeconds: payload?.retryAfterSeconds || 0,
          manualFallback: payload?.manualFallback || null
        };
      }

      return {
        success: true,
        message,
        code: payload?.code || null
      };
    } catch (error) {
      return {
        success: false,
        error: 'Unable to reach verification service. Please try again.',
        code: 'VERIFICATION_SERVICE_UNREACHABLE'
      };
    }
  };

  // Sign in with email/password
  const signIn = async (email, password) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      return { user: result.user, error: null };
    } catch (error) {
      console.error('Sign in error:', error);
      return { user: null, error: getAuthErrorMessage(error) };
    }
  };

  // Sign up with email/password
  const signUp = async (email, password, displayName) => {
    try {
      if (!isStrongPassword(password)) {
        return {
          user: null,
          error: 'Password must be at least 8 characters and include 1 uppercase letter, 1 number, and 1 special character.',
          needsVerification: false
        };
      }

      const result = await createUserWithEmailAndPassword(auth, email, password);
      
      // Create user profile in the app database.
      await callProfileEndpoint('POST', {
        email: result.user.email,
        displayName: displayName || '',
        photoURL: '',
        emailVerified: false,
        kycStatus: 'unverified',
        signInProvider: 'password',
      });

      let verificationWarning = null;

      // Prefer server-side SMTP flow (with fallback logging)
      const smtpDispatch = await callVerificationEndpoint('/api/auth/send-verification', {
        email: result.user.email
      });

      // Fallback provider if SMTP pipeline is unavailable
      if (!smtpDispatch.success) {
        try {
          await sendEmailVerification(result.user, {
            url: getVerificationRedirectUrl(),
            handleCodeInApp: true
          });
          verificationWarning = null;
        } catch (fallbackError) {
          verificationWarning = smtpDispatch.error || getAuthErrorMessage(fallbackError);
        }
      }
      
      return { user: result.user, error: null, needsVerification: true, verificationWarning };
    } catch (error) {
      console.error('Sign up error:', error);
      return { user: null, error: getAuthErrorMessage(error), needsVerification: false };
    }
  };

  // Sign in with Google
  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      // Create or update user profile in the app database.
      const userData = {
        email: result.user.email,
        displayName: result.user.displayName || '',
        photoURL: result.user.photoURL || '',
        emailVerified: true, // Google accounts are pre-verified
        kycStatus: 'unverified',
        signInProvider: 'google.com'
      };

      await callProfileEndpoint('POST', userData);
      
      return { user: result.user, error: null };
    } catch (error) {
      console.error('Google sign in error:', error);
      return { user: null, error: error.message };
    }
  };

  // Send email verification
  const sendVerificationEmail = async () => {
    try {
      if (!auth.currentUser) {
        throw new Error('No authenticated user');
      }

      await reload(auth.currentUser);
      if (auth.currentUser.emailVerified) {
        return { error: null };
      }

      const resendResult = await callVerificationEndpoint('/api/auth/resend-verification', {
        email: auth.currentUser.email
      });

      if (resendResult.success) {
        return { error: null, message: resendResult.message, code: resendResult.code };
      }

      if (resendResult.code === 'RATE_LIMITED') {
        return {
          error: resendResult.error,
          code: resendResult.code,
          retryAfterSeconds: resendResult.retryAfterSeconds || 60
        };
      }

      await sendEmailVerification(auth.currentUser, {
        url: getVerificationRedirectUrl(),
        handleCodeInApp: true
      });

      return {
        error: null,
        message: 'Verification email sent successfully. Please check your inbox.',
        code: 'FIREBASE_EMAIL_SENT'
      };
    } catch (error) {
      console.error('Send verification email error:', error);
      return { error: getAuthErrorMessage(error) };
    }
  };

  // Reload user to get updated emailVerified status
  const reloadUser = async () => {
    try {
      if (!auth.currentUser) {
        throw new Error('No authenticated user');
      }

      await reload(auth.currentUser);
      return { error: null, emailVerified: auth.currentUser.emailVerified };
    } catch (error) {
      console.error('Reload user error:', error);
      return { error: error.message };
    }
  };

  // Update user profile
  const updateProfile = async (profileData) => {
    try {
      if (!auth.currentUser) {
        throw new Error('No authenticated user');
      }

      // Update Firebase Auth profile when public identity fields change.
      if (profileData.displayName !== undefined || profileData.photoURL !== undefined) {
        await firebaseUpdateProfile(auth.currentUser, {
          ...(profileData.displayName !== undefined ? { displayName: profileData.displayName } : {}),
          ...(profileData.photoURL !== undefined ? { photoURL: profileData.photoURL || null } : {})
        });
      }

      const updateData = {
        ...profileData
      };

      const profilePayload = await callProfileEndpoint('PATCH', updateData);
      const userData = profilePayload.profile || {};
      
      setUser(prev => ({
        ...prev,
        ...profileData,
        phoneNumber: userData.phoneNumber || '',
        location: userData.location || '',
        bio: userData.bio || '',
        photoURL: userData.photoURL || profileData.photoURL || '',
        kycStatus: userData.kycStatus || 'unverified'
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
      // Clear all Hub-related localStorage data to prevent stale state issues
      localStorage.removeItem('hubCurrentCommunity');
      
      await firebaseSignOut(auth);
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
