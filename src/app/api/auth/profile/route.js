export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';

function cleanText(value, maxLength = 500) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function toIso(value) {
  if (!value) return null;
  if (value?.toDate && typeof value.toDate === 'function') return value.toDate().toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function serializeUserDoc(userId, data = {}) {
  return {
    uid: userId,
    email: data.email || '',
    displayName: data.displayName || '',
    photoURL: data.photoURL || '',
    emailVerified: Boolean(data.emailVerified),
    signInProvider: data.signInProvider || 'email',
    phoneNumber: data.phoneNumber || '',
    location: data.location || '',
    bio: data.bio || '',
    kycStatus: data.kycStatus || 'unverified',
    isAdmin: data.isAdmin === true,
    role: data.role || 'user',
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt)
  };
}

function buildProfilePatch(input = {}, authUser = {}) {
  const patch = {};

  if (Object.prototype.hasOwnProperty.call(input, 'email')) {
    patch.email = cleanText(input.email || authUser.email, 254).toLowerCase();
  }
  if (Object.prototype.hasOwnProperty.call(input, 'displayName')) {
    patch.displayName = cleanText(input.displayName, 160);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'photoURL')) {
    patch.photoURL = cleanText(input.photoURL, 500);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'emailVerified')) {
    patch.emailVerified = Boolean(input.emailVerified);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'signInProvider')) {
    patch.signInProvider = cleanText(input.signInProvider, 80) || 'email';
  }
  if (Object.prototype.hasOwnProperty.call(input, 'phoneNumber')) {
    patch.phoneNumber = cleanText(input.phoneNumber, 40);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'location')) {
    patch.location = cleanText(input.location, 180);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'bio')) {
    patch.bio = cleanText(input.bio, 1000);
  }

  return patch;
}

async function ensureProfile(authResult, input = {}) {
  const db = getAdminFirestore();
  const userRef = db.collection('users').doc(authResult.userId);
  const userDoc = await userRef.get();
  const now = new Date();

  const base = {
    email: authResult.user?.email || '',
    displayName: authResult.user?.name || '',
    photoURL: '',
    emailVerified: Boolean(authResult.user?.emailVerified),
    kycStatus: 'unverified',
    signInProvider: authResult.user?.signInProvider || 'email',
    role: 'user',
    isAdmin: false
  };

  const patch = buildProfilePatch(input, authResult.user);
  if (!userDoc.exists) {
    await userRef.set({
      ...base,
      ...patch,
      createdAt: now,
      updatedAt: now
    });
  } else if (Object.keys(patch).length) {
    await userRef.set({
      ...patch,
      updatedAt: now
    }, { merge: true });
  }

  const latest = await userRef.get();
  return serializeUserDoc(authResult.userId, latest.data() || {});
}

export async function GET(request) {
  const authResult = await verifyAuth(request);
  if (!authResult.success) return authResult.error;

  const profile = await ensureProfile(authResult);
  return NextResponse.json({ success: true, profile, source: 'postgres' });
}

export async function POST(request) {
  const authResult = await verifyAuth(request);
  if (!authResult.success) return authResult.error;

  const input = await request.json().catch(() => ({}));
  const profile = await ensureProfile(authResult, input);
  return NextResponse.json({ success: true, profile, source: 'postgres' });
}

export async function PATCH(request) {
  const authResult = await verifyAuth(request);
  if (!authResult.success) return authResult.error;

  const input = await request.json().catch(() => ({}));
  const profile = await ensureProfile(authResult, input);
  return NextResponse.json({ success: true, profile, source: 'postgres' });
}
