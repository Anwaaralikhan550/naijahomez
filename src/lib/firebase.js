// lib/firebase.js - Server-side authentication client
// This file now uses API endpoints instead of Firebase client SDK

// Authentication functions using server-side API
export const signIn = async (email, password) => {
  try {
    const response = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
      credentials: 'include'
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Sign in failed');
    }
    
    return { user: data.user, error: null };
  } catch (error) {
    return { user: null, error: error.message };
  }
};

export const signInWithGoogle = async () => {
  try {
    const response = await fetch('/api/auth/google', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include'
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Google sign in failed');
    }
    
    return { user: data.user, error: null };
  } catch (error) {
    return { user: null, error: error.message };
  }
};

export const register = async (email, password, displayName) => {
  try {
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, displayName }),
      credentials: 'include'
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Registration failed');
    }
    
    return { user: data.user, error: null };
  } catch (error) {
    return { user: null, error: error.message };
  }
};

export const logOut = async () => {
  try {
    const response = await fetch('/api/auth/signout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include'
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Sign out failed');
    }
    
    return { error: null };
  } catch (error) {
    return { error: error.message };
  }
};

// Deprecated exports - kept for compatibility but will throw helpful errors
export const db = new Proxy({}, {
  get() {
    throw new Error('Direct Firestore access is deprecated. Use API endpoints instead.');
  }
});

export const auth = new Proxy({}, {
  get() {
    throw new Error('Direct Firebase Auth access is deprecated. Use AuthContext methods instead.');
  }
});