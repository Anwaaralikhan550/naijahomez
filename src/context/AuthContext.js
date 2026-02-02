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
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase-client';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Helper function to determine if email verification should be required
  const shouldRequireEmailVerification = (firebaseUser, userData = {}) => {
    // Google sign-in users are already verified by Google
    if (firebaseUser.providerData.some(provider => provider.providerId === 'google.com')) {
      return false;
    }
    
    // Check if user explicitly marked as not requiring verification (e.g., by migration script)
    if (userData.requiresEmailVerification === false) {
      return false;
    }
    
    // Users created before email verification was implemented (multiple fallback dates)
    const createdAt = userData.createdAt?.toDate?.() || 
                     (firebaseUser.metadata.creationTime ? new Date(firebaseUser.metadata.creationTime) : null);
    
    const verificationCutoffDate = new Date('2025-08-27'); // Today's date - adjust as needed
    
    if (createdAt && createdAt < verificationCutoffDate) {
      return false; // Legacy users don't need verification
    }
    
    // If we can't determine creation date, be lenient for existing users
    if (!createdAt) {
      console.warn('Could not determine user creation date, assuming legacy user');
      return false;
    }
    
    // New email/password users need verification
    return !firebaseUser.emailVerified;
  };

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Get additional user data from Firestore
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          const userData = userDoc.data() || {};
          
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
            signInProvider: firebaseUser.providerData[0]?.providerId || 'email'
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
        return 'Password is too weak. Please use at least 6 characters.';
      default:
        return 'An error occurred. Please try again.';
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
      const result = await createUserWithEmailAndPassword(auth, email, password);
      
      // Send email verification
      await sendEmailVerification(result.user, {
        url: `${window.location.origin}/verify-email?continueUrl=${encodeURIComponent('/dashboard')}`,
        handleCodeInApp: true
      });
      
      // Create user document in Firestore
      await setDoc(doc(db, 'users', result.user.uid), {
        email: result.user.email,
        displayName: displayName || '',
        photoURL: '',
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      return { user: result.user, error: null, needsVerification: true };
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
      
      // Create or update user document in Firestore
      const userRef = doc(db, 'users', result.user.uid);
      const userSnap = await getDoc(userRef);
      
      const userData = {
        email: result.user.email,
        displayName: result.user.displayName || '',
        photoURL: result.user.photoURL || '',
        emailVerified: true, // Google accounts are pre-verified
        signInProvider: 'google.com',
        updatedAt: new Date()
      };
      
      if (!userSnap.exists()) {
        userData.createdAt = new Date();
      }
      
      await setDoc(userRef, userData, { merge: true });
      
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

      await sendEmailVerification(auth.currentUser, {
        url: `${window.location.origin}/verify-email?continueUrl=${encodeURIComponent('/dashboard')}`,
        handleCodeInApp: true
      });

      return { error: null };
    } catch (error) {
      console.error('Send verification email error:', error);
      return { error: error.message };
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

      // Update Firebase Auth profile if displayName changed
      if (profileData.displayName !== undefined) {
        await firebaseUpdateProfile(auth.currentUser, {
          displayName: profileData.displayName
        });
      }

      // Update Firestore user document
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const updateData = {
        ...profileData,
        updatedAt: new Date()
      };

      await updateDoc(userRef, updateData);

      // Trigger a re-fetch of user data by forcing auth state refresh
      const updatedUserDoc = await getDoc(userRef);
      const userData = updatedUserDoc.data() || {};
      
      setUser(prev => ({
        ...prev,
        ...profileData,
        phoneNumber: userData.phoneNumber || '',
        location: userData.location || '',
        bio: userData.bio || ''
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