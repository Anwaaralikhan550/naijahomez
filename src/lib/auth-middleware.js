// Production-ready auth middleware with Firebase ID token verification
// Verifies tokens server-side using Firebase Admin SDK

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from './firebase-admin';
import logger from './logger';

/**
 * Verifies the Firebase ID token from the Authorization header.
 * Returns the authenticated user's UID if valid, or an error response if not.
 */
export async function verifyAuth(request) {
  try {
    // Extract Bearer token from Authorization header
    const authHeader = request.headers.get('authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return {
        success: false,
        error: NextResponse.json(
          { error: 'Authorization header with Bearer token required' },
          { status: 401 }
        )
      };
    }

    const idToken = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!idToken || idToken.length < 100) {
      return {
        success: false,
        error: NextResponse.json(
          { error: 'Invalid authorization token format' },
          { status: 401 }
        )
      };
    }

    // Verify the ID token using Firebase Admin SDK
    let adminAuth;
    try {
      adminAuth = getAdminAuth();
    } catch (initError) {
      // Firebase Admin not configured - log and return error
      logger.error('Firebase Admin not initialized', initError);
      return {
        success: false,
        error: NextResponse.json(
          { error: 'Authentication service unavailable' },
          { status: 503 }
        )
      };
    }

    const decodedToken = await adminAuth.verifyIdToken(idToken);

    // Token is valid - return user info
    return {
      success: true,
      userId: decodedToken.uid,
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified,
        name: decodedToken.name,
        isAdmin: decodedToken.admin === true || decodedToken.isAdmin === true,
        role: decodedToken.role || null
      }
    };

  } catch (error) {
    // Handle specific Firebase Auth errors
    if (error.code === 'auth/id-token-expired') {
      return {
        success: false,
        error: NextResponse.json(
          { error: 'Token expired. Please sign in again.' },
          { status: 401 }
        )
      };
    }

    if (error.code === 'auth/id-token-revoked') {
      return {
        success: false,
        error: NextResponse.json(
          { error: 'Token revoked. Please sign in again.' },
          { status: 401 }
        )
      };
    }

    if (error.code === 'auth/argument-error' || error.code === 'auth/invalid-id-token') {
      return {
        success: false,
        error: NextResponse.json(
          { error: 'Invalid authentication token' },
          { status: 401 }
        )
      };
    }

    // Log unexpected errors for debugging (without sensitive info)
    logger.error('Auth verification failed', error);

    return {
      success: false,
      error: NextResponse.json(
        { error: 'Authentication verification failed' },
        { status: 401 }
      )
    };
  }
}

/**
 * Verifies if the authenticated user has admin privileges.
 * Checks the user document in Firestore for isAdmin flag.
 */
export async function isAdmin(request) {
  // First verify the user is authenticated
  const authResult = await verifyAuth(request);

  if (!authResult.success) {
    return authResult;
  }

  try {
    if (authResult.user?.isAdmin === true || authResult.user?.role === 'admin') {
      return {
        success: true,
        userId: authResult.userId,
        user: {
          ...authResult.user,
          isAdmin: true
        }
      };
    }

    // Check user's admin status in Firestore
    const db = getAdminFirestore();
    const userDoc = await db.collection('users').doc(authResult.userId).get();

    if (!userDoc.exists) {
      return {
        success: false,
        error: NextResponse.json(
          { error: 'User not found' },
          { status: 403 }
        )
      };
    }

    const userData = userDoc.data();

    // Check for admin flag
    if (userData?.isAdmin !== true && userData?.role !== 'admin') {
      return {
        success: false,
        error: NextResponse.json(
          { error: 'Admin access required' },
          { status: 403 }
        )
      };
    }

    return {
      success: true,
      userId: authResult.userId,
      user: {
        ...authResult.user,
        isAdmin: true
      }
    };

  } catch (error) {
    logger.error('Admin verification error', error);
    return {
      success: false,
      error: NextResponse.json(
        { error: 'Failed to verify admin status' },
        { status: 500 }
      )
    };
  }
}

export function requireAuth(handler) {
  return async (request, context) => {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    return handler(request, context);
  };
}

export function requireAdmin(handler) {
  return async (request, context) => {
    const authResult = await isAdmin(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }
    return handler(request, context);
  };
}
