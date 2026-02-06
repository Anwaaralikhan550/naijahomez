import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';

// Initialize admin SDK
initAdmin();

const db = getFirestore();

// GET - Fetch power status for a community
export async function GET(request) {
  try {
    // SECURITY: Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const { searchParams } = new URL(request.url);
    const communityId = searchParams.get('communityId');
    
    if (!communityId) {
      return NextResponse.json(
        { error: 'Community ID is required' },
        { status: 400 }
      );
    }

    const statusRef = db.collection('hubPowerStatus').doc(communityId);
    const statusDoc = await statusRef.get();
    
    if (!statusDoc.exists) {
      return NextResponse.json({
        success: true,
        data: {
          status: 'unknown',
          lastUpdate: null,
          updatedBy: null,
          lastOutage: null
        }
      });
    }

    const statusData = statusDoc.data();
    
    return NextResponse.json({
      success: true,
      data: {
        ...statusData,
        lastUpdate: statusData.lastUpdate?.toDate?.() || null,
        lastOutage: statusData.lastOutage?.toDate?.() || null
      }
    });

  } catch (error) {
    console.error('Error fetching power status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch power status' },
      { status: 500 }
    );
  }
}

// POST - Update power status for a community
export async function POST(request) {
  try {
    const data = await request.json();
    const {
      communityId,
      status, // 'on', 'off', 'unknown'
      updatedBy,
      updatedById,
      lastUpdate,
      lastOutage
    } = data;

    // Validate required fields
    if (!communityId || !status || !updatedBy || !updatedById) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = ['on', 'off', 'unknown'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be: on, off, or unknown' },
        { status: 400 }
      );
    }

    const statusData = {
      communityId,
      status,
      updatedBy,
      updatedById,
      lastUpdate: new Date(lastUpdate),
      updatedAt: new Date()
    };

    // Only update lastOutage if power is off
    if (status === 'off' && lastOutage) {
      statusData.lastOutage = new Date(lastOutage);
    }

    const statusRef = db.collection('hubPowerStatus').doc(communityId);
    await statusRef.set(statusData, { merge: true });
    
    // Create notification for power status change
    try {
      const { createNotification } = await import('@/lib/hubFirestore');
      
      const notificationTitle = status === 'on' ? 
        '⚡ Power Restored' : 
        '🔌 Power Outage Reported';
      
      const notificationMessage = status === 'on' ?
        `Community power has been restored. Updated by ${updatedBy}` :
        `Power outage reported in the community. Updated by ${updatedBy}`;

      await createNotification({
        communityId,
        userId: 'all', // Special marker for all users
        type: 'power_status',
        title: notificationTitle,
        message: notificationMessage,
        priority: status === 'off' ? 'high' : 'medium',
        createdBy: updatedBy,
        metadata: {
          powerStatus: status,
          statusChange: status
        }
      });
    } catch (notificationError) {
      console.warn('Failed to create notification for power status:', notificationError);
    }
    
    return NextResponse.json({
      success: true,
      data: statusData
    });

  } catch (error) {
    console.error('Error updating power status:', error);
    return NextResponse.json(
      { error: 'Failed to update power status' },
      { status: 500 }
    );
  }
}