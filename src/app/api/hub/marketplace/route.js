export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import { getAdminFirestore } from '@/lib/firebase-admin';

function errorResponse(message, code = 'INTERNAL_ERROR', status = 500) {
  return NextResponse.json({ success: false, error: message, code }, { status });
}

async function authFailureResponse(authError, fallbackCode = 'UNAUTHORIZED') {
  const status = authError?.status || 401;
  let message = status === 403 ? 'Forbidden' : status === 503 ? 'Authentication service unavailable' : 'Unauthorized';

  try {
    const payload = await authError.clone().json();
    if (typeof payload?.error === 'string' && payload.error.trim()) {
      message = payload.error;
    }
  } catch {
    // Keep fallback message.
  }

  const code =
    status === 401 ? 'UNAUTHORIZED' :
    status === 403 ? 'FORBIDDEN' :
    status === 404 ? 'NOT_FOUND' :
    status === 503 ? 'SERVICE_UNAVAILABLE' :
    fallbackCode;

  return errorResponse(message, code, status);
}


import {
  isUserActiveCommunityMember,
  updateDocument,
  deleteDocument
} from '@/lib/hubFirestore';

export async function GET(request) {
  try {
    // SECURITY: Verify authentication before reading community marketplace
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authFailureResponse(authResult.error);
    }

    const userId = authResult.userId;
    const { searchParams } = new URL(request.url);
    const communityId = searchParams.get('communityId');

    if (!communityId) {
      return errorResponse('Community ID is required', 'VALIDATION_ERROR', 400);
    }

    const isMember = await isUserActiveCommunityMember(userId, communityId);

    if (!isMember) {
      return errorResponse('You are not a member of this community', 'FORBIDDEN', 403);
    }

    const db = getAdminFirestore();
    const snapshot = await db.collection('marketplace')
      .where('status', '==', 'active')
      .where('communityId', '==', communityId)
      .limit(200)
      .get();

    const items = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt || null
      };
    }).sort((a, b) => {
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      return bTime - aTime;
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Error in marketplace API:', error);
    return errorResponse(error.message, 'INTERNAL_ERROR', 500);
  }
}

export async function POST(request) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authFailureResponse(authResult.error);
    }

    const userId = authResult.userId;
    const body = await request.json();
    const { action, ...data } = body;

    if (action === 'create_item') {
      const communityId = typeof data.communityId === 'string' ? data.communityId.trim() : '';
      if (!communityId) {
        return errorResponse('Community ID is required', 'VALIDATION_ERROR', 400);
      }

      const isMember = await isUserActiveCommunityMember(userId, communityId);
      if (!isMember) {
        return errorResponse('You are not a member of this community', 'FORBIDDEN', 403);
      }

      const db = getAdminFirestore();
      const docRef = db.collection('marketplace').doc();
      const rawTitle = typeof data.title === 'string' ? data.title.trim() : '';
      const slugBase = (rawTitle || 'marketplace-item').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      const slug = `${slugBase || 'marketplace-item'}-${docRef.id.slice(-6)}`;

      const itemData = {
        ...data,
        communityId,
        userId,
        slug,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        titleLower: rawTitle.toLowerCase(),
        locationLower: String(data.location || '').toLowerCase(),
        priceNumeric: parseFloat(String(data.price || 0).replace(/[^0-9.]/g, '')) || 0
      };

      await docRef.set(itemData);
      const itemId = docRef.id;
      return NextResponse.json({ success: true, itemId });
    }

    if (action === 'update_item') {
      const { itemId, ...updateData } = data;
      await updateDocument('marketplace', itemId, updateData);
      return NextResponse.json({ success: true });
    }

    if (action === 'delete_item') {
      const { itemId } = data;
      await deleteDocument('marketplace', itemId);
      return NextResponse.json({ success: true });
    }

    return errorResponse('Invalid action', 'VALIDATION_ERROR', 400);
  } catch (error) {
    console.error('Error in marketplace POST:', error);
    return errorResponse(error.message, 'INTERNAL_ERROR', 500);
  }
}
