export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';

function cleanDraftId(value) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 80);
}

function serializeDoc(snapshot) {
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    ...data,
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || null,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt || null
  };
}

async function getOwnedDraftRef(request, params, { requireExisting = true } = {}) {
  const authResult = await verifyAuth(request);
  if (!authResult.success) return { error: authResult.error };

  const { id } = await params;
  const draftId = cleanDraftId(id);
  if (!draftId) {
    return {
      error: NextResponse.json({ success: false, error: 'Draft ID is required' }, { status: 400 })
    };
  }

  const db = getAdminFirestore();
  const ref = db.collection('drafts').doc(draftId);
  const snapshot = await ref.get();

  if (requireExisting && !snapshot.exists) {
    return {
      error: NextResponse.json({ success: false, error: 'Draft not found' }, { status: 404 })
    };
  }

  const data = snapshot.exists ? snapshot.data() || {} : {};
  if (snapshot.exists && data.userId && data.userId !== authResult.userId) {
    return {
      error: NextResponse.json({ success: false, error: 'You can only access your own draft' }, { status: 403 })
    };
  }

  return { authResult, ref, snapshot, draftId };
}

export async function GET(request, { params }) {
  const result = await getOwnedDraftRef(request, params);
  if (result.error) return result.error;

  return NextResponse.json({
    success: true,
    exists: result.snapshot.exists,
    draft: serializeDoc(result.snapshot),
    source: 'postgres'
  });
}

export async function PUT(request, { params }) {
  const result = await getOwnedDraftRef(request, params, { requireExisting: false });
  if (result.error) return result.error;

  const body = await request.json().catch(() => ({}));
  const now = new Date();
  await result.ref.set({
    ...body,
    userId: result.authResult.userId,
    status: body.status || 'draft',
    createdAt: result.snapshot.exists ? (result.snapshot.data()?.createdAt || now) : now,
    updatedAt: now
  }, { merge: true });

  const latest = await result.ref.get();
  return NextResponse.json({
    success: true,
    exists: true,
    draft: serializeDoc(latest),
    source: 'postgres'
  });
}

export async function PATCH(request, { params }) {
  return PUT(request, { params });
}

export async function DELETE(request, { params }) {
  const result = await getOwnedDraftRef(request, params);
  if (result.error) return result.error;

  await result.ref.delete();
  return NextResponse.json({ success: true, deleted: true, source: 'postgres' });
}
