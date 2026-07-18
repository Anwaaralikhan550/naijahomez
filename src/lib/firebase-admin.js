// Firebase Admin SDK - Server-side API operations only
// Used for: Data CRUD operations in API routes
// NOT used for: Authentication (that's handled by Client SDK)

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  getPostgresDocumentStore,
  shouldUsePostgresDocumentStore
} = require('./db/postgres-document-store.cjs');

let adminApp;

export function initAdmin() {
  if (getApps().length === 0) {
    try {
      // First try to use the full service account key
      const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
      
      if (serviceAccountKey) {
        // Parse the JSON service account key
        const serviceAccount = JSON.parse(serviceAccountKey);
        
        adminApp = initializeApp({
          credential: cert(serviceAccount),
          projectId: serviceAccount.project_id,
        });
        console.log('Firebase Admin SDK initialized with service account key');
      } else {
        // Fallback to individual environment variables
        const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKey = process.env.FIREBASE_PRIVATE_KEY;

        if (!projectId || !clientEmail || !privateKey) {
          console.warn('Firebase Admin environment variables not configured. Some API routes may not work.');
          return null;
        }

        adminApp = initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n'),
          }),
          projectId,
        });
        console.log('Firebase Admin SDK initialized with individual env vars');
      }
    } catch (error) {
      console.error('Firebase Admin initialization error:', error);
      console.warn('Falling back to mock mode for build purposes');
      return null;
    }
  } else {
    adminApp = getApps()[0];
  }
  return adminApp;
}

// Get Admin Firestore (for server-side data operations)
export function getAdminFirestore() {
  if (shouldUsePostgresDocumentStore()) {
    return getPostgresDocumentStore();
  }

  if (!adminApp) {
    adminApp = initAdmin();
  }
  if (!adminApp) {
    throw new Error('Firebase Admin not initialized - missing environment variables');
  }
  return getFirestore(adminApp);
}

// Get Admin Auth (for server-side user verification only)
export function getAdminAuth() {
  if (!adminApp) {
    adminApp = initAdmin();
  }
  if (!adminApp) {
    throw new Error('Firebase Admin not initialized - missing environment variables');
  }
  return getAuth(adminApp);
}

export default { initAdmin, getAdminFirestore, getAdminAuth };
