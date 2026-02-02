import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth-middleware';
import logger from '@/lib/logger';

export async function GET(request) {
  try {
    // SECURITY: Verify admin authentication
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

    // Get all members for the community
    const querySnapshot = await db.collection('hubMembers')
      .where('communityId', '==', communityId)
      .where('isActive', '==', true)
      .orderBy('joinedAt', 'desc')
      .get();
    const members = [];
    querySnapshot.forEach((doc) => {
      members.push({ id: doc.id, ...doc.data() });
    });

    return NextResponse.json({ members });
  } catch (error) {
    logger.error('Error in admin members API', error);
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
    const { action, memberId, adminId, ...data } = body;

    if (!adminId) {
      return NextResponse.json({ error: 'Admin ID is required' }, { status: 400 });
    }

    if (action === 'update_role') {
      const { role } = data;
      
      if (!memberId || !role) {
        return NextResponse.json({ error: 'Member ID and role are required' }, { status: 400 });
      }

      // Validate role
      const validRoles = ['member', 'moderator', 'admin'];
      if (!validRoles.includes(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }

      await db.collection('hubMembers').doc(memberId).update({
        role,
        lastModifiedBy: adminId,
        lastModifiedAt: new Date()
      });

      return NextResponse.json({ success: true });
    }

    if (action === 'remove_member') {
      if (!memberId) {
        return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
      }

      // Soft delete - mark as inactive instead of deleting
      await db.collection('hubMembers').doc(memberId).update({
        isActive: false,
        removedBy: adminId,
        removedAt: new Date()
      });

      return NextResponse.json({ success: true });
    }

    if (action === 'update_member') {
      const { unitNumber, phoneNumber, notes } = data;
      
      if (!memberId) {
        return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
      }

      const updateData = {
        lastModifiedBy: adminId,
        lastModifiedAt: new Date()
      };

      if (unitNumber !== undefined) updateData.unitNumber = unitNumber;
      if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
      if (notes !== undefined) updateData.adminNotes = notes;

      await db.collection('hubMembers').doc(memberId).update(updateData);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in admin members POST:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}