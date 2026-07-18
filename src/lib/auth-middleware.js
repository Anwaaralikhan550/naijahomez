// Production-ready auth middleware with Firebase ID token verification
// Verifies tokens server-side using Firebase Admin SDK

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from './firebase-admin';
import logger from './logger';
import { verifyAccessToken } from './auth/tokens';

// Peeks a JWT's unverified header to tell a self-issued Postgres access
// token (HS256, see src/lib/auth/tokens.js) apart from a Firebase ID token
// (RS256, signed by Google's rotating keys). This only reads the header to
// decide which verifier to run -- the chosen verifier still fully validates
// the signature against its own trusted key material, so a forged header
// can only route to the wrong (and then failing) verifier, never bypass one.
function isPostgresAccessToken(token) {
  try {
    const [headerB64] = token.split('.');
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
    return header.alg === 'HS256';
  } catch {
    return false;
  }
}

/**
 * Verifies the Authorization header's Bearer token, routing to whichever
 * verifier matches the token's signing algorithm: the self-issued Postgres
 * JWT (src/lib/auth/tokens.js) or the legacy Firebase ID token. Both paths
 * return the same {success, userId, user} shape, so every one of the ~97
 * call sites of verifyAuth() works unchanged regardless of which auth
 * system actually issued the caller's token.
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

    if (!idToken || idToken.length < 20) {
      return {
        success: false,
        error: NextResponse.json(
          { error: 'Invalid authorization token format' },
          { status: 401 }
        )
      };
    }

    if (isPostgresAccessToken(idToken)) {
      return verifyAuthPostgres(request);
    }

    if (idToken.length < 100) {
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
 * Verifies a self-issued Postgres-native JWT (see src/lib/auth/tokens.js)
 * from the Authorization header. Returns the same {success, userId, user}
 * shape as verifyAuth() so every downstream call site keeps working
 * unchanged. verifyAuth() routes here automatically for HS256 tokens (see
 * isPostgresAccessToken() above) -- exported separately too in case a
 * caller ever needs to require a Postgres session specifically.
 */
export async function verifyAuthPostgres(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return {
        success: false,
        error: NextResponse.json({ error: 'Authorization header with Bearer token required' }, { status: 401 })
      };
    }

    const token = authHeader.substring(7);
    const payload = await verifyAccessToken(token);

    return {
      success: true,
      userId: payload.uid,
      user: {
        uid: payload.uid,
        email: payload.email,
        emailVerified: payload.emailVerified,
        name: null,
        isAdmin: payload.isAdmin,
        role: payload.role
      }
    };
  } catch (error) {
    return {
      success: false,
      error: NextResponse.json({ error: 'Invalid or expired session. Please log in again.' }, { status: 401 })
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
