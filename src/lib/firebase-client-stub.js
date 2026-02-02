// This file is a stub for the old client-side Firebase SDK
// All authentication is now handled server-side
// This prevents import errors during the transition

console.warn('Client-side Firebase SDK is deprecated. Use server-side authentication instead.');

// Mock functions that throw helpful errors
const createStubFunction = (name) => () => {
  throw new Error(`${name} is deprecated. Use AuthContext methods instead.`);
};

// Firebase App stubs
export const initializeApp = createStubFunction('initializeApp');
export const getApps = () => [];
export const getApp = createStubFunction('getApp');

// Firebase Auth stubs
export const getAuth = createStubFunction('getAuth');
export const onAuthStateChanged = createStubFunction('onAuthStateChanged');
export const signInWithEmailAndPassword = createStubFunction('signInWithEmailAndPassword');
export const createUserWithEmailAndPassword = createStubFunction('createUserWithEmailAndPassword');
export const signInWithPopup = createStubFunction('signInWithPopup');
export const signOut = createStubFunction('signOut');
export const GoogleAuthProvider = function() {
  throw new Error('GoogleAuthProvider is deprecated. Use AuthContext.signInWithGoogle instead.');
};
export const updateProfile = createStubFunction('updateProfile');
export const sendPasswordResetEmail = createStubFunction('sendPasswordResetEmail');
export const confirmPasswordReset = createStubFunction('confirmPasswordReset');
export const verifyPasswordResetCode = createStubFunction('verifyPasswordResetCode');

// Legacy functions that return errors
export const signIn = createStubFunction('signIn');
export const signInWithGoogle = createStubFunction('signInWithGoogle');
export const register = createStubFunction('register');
export const logOut = createStubFunction('logOut');

// Legacy exports that might still be imported
export const db = null;
export const auth = {
  currentUser: null,
  onAuthStateChanged: createStubFunction('auth.onAuthStateChanged')
};