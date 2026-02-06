import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';

// Initialize admin SDK
initAdmin();

const db = getFirestore();

// GET - Fetch emergency alerts for a community
export async function GET(request) {
  try {
    // SECURITY: Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const { searchParams } = new URL(request.url);
    const communityId = searchParams.get('communityId');
    const alertType = searchParams.get('type'); // weather, flood, power, general
    const isActive = searchParams.get('active'); // true/false
    
    if (!communityId) {
      return NextResponse.json(
        { error: 'Community ID is required' },
        { status: 400 }
      );
    }

    let query = db.collection('hubEmergencyAlerts')
      .where('communityId', '==', communityId);
    
    if (alertType) {
      query = query.where('alertType', '==', alertType);
    }

    if (isActive !== null) {
      query = query.where('isActive', '==', isActive === 'true');
    }
    
    const snapshot = await query
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    
    const alerts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || null,
      expiresAt: doc.data().expiresAt?.toDate?.() || null,
      updatedAt: doc.data().updatedAt?.toDate?.() || null
    }));

    return NextResponse.json({
      success: true,
      data: alerts,
      count: alerts.length
    });

  } catch (error) {
    console.error('Error fetching emergency alerts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch emergency alerts' },
      { status: 500 }
    );
  }
}

// POST - Create new emergency alert
export async function POST(request) {
  try {
    const data = await request.json();
    const {
      communityId,
      type, // 'weather_alert', 'emergency', 'maintenance', etc.
      title,
      message,
      alertType, // weather, flood, power, general
      priority, // low, medium, high, critical
      createdBy,
      createdById,
      expiresAt,
      isActive = true,
      metadata = {}
    } = data;

    // Validate required fields
    if (!communityId || !title || !message || !createdBy || !createdById) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate priority
    const validPriorities = ['low', 'medium', 'high', 'critical'];
    if (priority && !validPriorities.includes(priority)) {
      return NextResponse.json(
        { error: 'Invalid priority. Must be: low, medium, high, or critical' },
        { status: 400 }
      );
    }

    const alertData = {
      communityId,
      type: type || 'emergency_alert',
      title,
      message,
      alertType: alertType || 'general',
      priority: priority || 'medium',
      createdBy,
      createdById,
      isActive,
      metadata,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (expiresAt) {
      alertData.expiresAt = new Date(expiresAt);
    }

    const docRef = await db.collection('hubEmergencyAlerts').add(alertData);
    
    // Also create a notification for this alert using the existing system
    try {
      const { createNotification } = await import('@/lib/hubFirestore');
      
      await createNotification({
        communityId,
        userId: 'all', // Special marker for all users
        type: alertType || 'emergency_alert',
        title: `⚠️ ${title}`,
        message: message,
        priority: priority || 'medium',
        createdBy,
        metadata: {
          alertId: docRef.id,
          alertType: alertType
        }
      });
    } catch (notificationError) {
      console.warn('Failed to create notification for alert:', notificationError);
      // Don't fail the entire request if notification creation fails
    }
    
    return NextResponse.json({
      success: true,
      data: {
        id: docRef.id,
        ...alertData
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating emergency alert:', error);
    return NextResponse.json(
      { error: 'Failed to create emergency alert' },
      { status: 500 }
    );
  }
}

// PUT - Update emergency alert (deactivate, modify, etc.)
export async function PUT(request) {
  try {
    const data = await request.json();
    const {
      alertId,
      action, // 'deactivate', 'activate', 'update'
      userId,
      isActive,
      title,
      message,
      priority,
      expiresAt,
      ...otherUpdates
    } = data;

    if (!alertId) {
      return NextResponse.json(
        { error: 'Alert ID is required' },
        { status: 400 }
      );
    }

    const alertRef = db.collection('hubEmergencyAlerts').doc(alertId);
    const alertDoc = await alertRef.get();
    
    if (!alertDoc.exists) {
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      );
    }

    let updateData = { updatedAt: new Date() };

    switch (action) {
      case 'deactivate':
        updateData.isActive = false;
        break;
      
      case 'activate':
        updateData.isActive = true;
        break;
      
      case 'update':
        if (title) updateData.title = title;
        if (message) updateData.message = message;
        if (priority) updateData.priority = priority;
        if (expiresAt) updateData.expiresAt = new Date(expiresAt);
        if (isActive !== undefined) updateData.isActive = isActive;
        break;
      
      default:
        // Generic update
        updateData = { ...updateData, ...otherUpdates };
        break;
    }

    await alertRef.update(updateData);

    const updatedDoc = await alertRef.get();
    const updatedData = updatedDoc.data();

    return NextResponse.json({
      success: true,
      data: {
        id: alertId,
        ...updatedData,
        createdAt: updatedData.createdAt?.toDate?.() || null,
        expiresAt: updatedData.expiresAt?.toDate?.() || null,
        updatedAt: updatedData.updatedAt?.toDate?.() || null
      }
    });

  } catch (error) {
    console.error('Error updating emergency alert:', error);
    return NextResponse.json(
      { error: 'Failed to update emergency alert' },
      { status: 500 }
    );
  }
}

// DELETE - Delete emergency alert (admin only)
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const alertId = searchParams.get('alertId');
    const userId = searchParams.get('userId');
    
    if (!alertId || !userId) {
      return NextResponse.json(
        { error: 'Alert ID and User ID are required' },
        { status: 400 }
      );
    }

    const alertRef = db.collection('hubEmergencyAlerts').doc(alertId);
    const alertDoc = await alertRef.get();
    
    if (!alertDoc.exists) {
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      );
    }

    const alertData = alertDoc.data();
    
    // Only allow deletion by the creator
    if (alertData.createdById !== userId) {
      return NextResponse.json(
        { error: 'Only the alert creator can delete this alert' },
        { status: 403 }
      );
    }

    await alertRef.delete();

    return NextResponse.json({
      success: true,
      message: 'Emergency alert deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting emergency alert:', error);
    return NextResponse.json(
      { error: 'Failed to delete emergency alert' },
      { status: 500 }
    );
  }
}