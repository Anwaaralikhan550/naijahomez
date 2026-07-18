export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth-middleware';
import cache from '@/lib/cache';

const errorResponse = (status, code, message, details = null) =>
  NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {})
      }
    },
    { status }
  );

export async function POST(request) {
  try {
    const adminResult = await isAdmin(request);
    if (!adminResult.success) {
      return errorResponse(403, 'ADMIN_REQUIRED', 'Admin access required');
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return errorResponse(400, 'INVALID_JSON', 'Invalid JSON payload');
    }

    const { propertyId, newSlug, oldSlug } = body || {};
    const normalizedPropertyId = String(propertyId || '').trim();
    const normalizedNewSlug = String(newSlug || '').trim();
    const normalizedOldSlug = oldSlug == null ? '' : String(oldSlug).trim();

    if (!normalizedPropertyId || !normalizedNewSlug) {
      return errorResponse(400, 'INVALID_INPUT', 'propertyId and newSlug are required');
    }

    if (typeof propertyId !== 'string' || typeof newSlug !== 'string' || (oldSlug != null && typeof oldSlug !== 'string')) {
      return errorResponse(400, 'INVALID_INPUT_TYPE', 'propertyId, newSlug, and oldSlug must be strings');
    }

    const db = getAdminFirestore();

    await db.collection('properties').doc(normalizedPropertyId).update({
      slug: normalizedNewSlug,
      updatedAt: new Date()
    });

    cache.clear();

    return NextResponse.json({
      success: true,
      propertyId: normalizedPropertyId,
      oldSlug: normalizedOldSlug,
      newSlug: normalizedNewSlug,
      message: 'Slug updated successfully'
    });

  } catch (error) {
    console.error('Error fixing slug:', error);
    return errorResponse(500, 'SLUG_UPDATE_FAILED', 'Failed to update slug');
  }
}
