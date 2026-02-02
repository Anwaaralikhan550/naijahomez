import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth, isAdmin } from '@/lib/auth-middleware';
import logger from '@/lib/logger';

export async function GET(request) {
  try {
    // SECURITY: Verify admin authentication - MANDATORY
    const adminResult = await isAdmin(request);
    if (!adminResult.success) {
      return adminResult.error;
    }

    const db = getAdminFirestore();

    const { searchParams } = new URL(request.url);
    const communityId = searchParams.get('communityId');

    if (!communityId) {
      return NextResponse.json({ error: 'Community ID is required' }, { status: 400 });
    }

    // Admin view - get all access codes for the community
    const querySnapshot = await db.collection('hubAccessCodes')
      .where('communityId', '==', communityId)
      .orderBy('createdAt', 'desc')
      .get();
    const accessCodes = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      accessCodes.push({
        id: doc.id,
        ...data,
        usesLeft: data.maxUses ? Math.max(0, data.maxUses - (data.usedCount || 0)) : null
      });
    });

    return NextResponse.json({ accessCodes });
  } catch (error) {
    logger.error('Error in access-codes GET', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    // SECURITY: Verify admin authentication - MANDATORY
    const adminResult = await isAdmin(request);
    if (!adminResult.success) {
      return adminResult.error;
    }

    const db = getAdminFirestore();
    const userId = adminResult.userId;
    const body = await request.json();
    const { action, ...data } = body;

    if (action === 'create_code') {
      const {
        communityId,
        code,
        description,
        maxUses,
        expiresAt,
        role,
        isActive,
        createdBy,
        createdByName
      } = data;

      if (!communityId || !code || !description || !createdBy) {
        return NextResponse.json({ error: 'Required fields missing' }, { status: 400 });
      }

      // Check if code already exists
      const existingCodes = await db.collection('hubAccessCodes')
        .where('code', '==', code.toUpperCase())
        .get();
      
      if (!existingCodes.empty) {
        return NextResponse.json({ error: 'Access code already exists' }, { status: 400 });
      }

      const accessCodeData = {
        communityId,
        code: code.toUpperCase(),
        description: description.trim(),
        maxUses: maxUses || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        role: role || 'member',
        isActive: isActive !== false,
        usedCount: 0,
        createdBy,
        createdByName,
        createdAt: new Date(),
        lastModifiedAt: new Date()
      };

      const docRef = await db.collection('hubAccessCodes').add(accessCodeData);
      return NextResponse.json({ codeId: docRef.id });
    }

    if (action === 'toggle_status') {
      const { codeId, isActive } = data;
      
      if (!codeId || isActive === undefined) {
        return NextResponse.json({ error: 'Code ID and status are required' }, { status: 400 });
      }

      await db.collection('hubAccessCodes').doc(codeId).update({
        isActive,
        lastModifiedAt: new Date()
      });

      return NextResponse.json({ success: true });
    }

    if (action === 'delete_code') {
      const { codeId } = data;
      
      if (!codeId) {
        return NextResponse.json({ error: 'Code ID is required' }, { status: 400 });
      }

      // Soft delete by marking as inactive and deleted
      await db.collection('hubAccessCodes').doc(codeId).update({
        isActive: false,
        isDeleted: true,
        deletedAt: new Date()
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in access-codes POST:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}