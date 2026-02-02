import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import logger from '@/lib/logger';

// Helper function to verify community membership
async function verifyCommunityMembership(db, userId, communityId) {
  const memberQuery = await db.collection('hubMembers')
    .where('userId', '==', userId)
    .where('communityId', '==', communityId)
    .where('isActive', '==', true)
    .limit(1)
    .get();

  return !memberQuery.empty;
}

// GET - Fetch emergency data for a community
export async function GET(request) {
  try {
    // SECURITY: Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const userId = authResult.userId;
    const db = getAdminFirestore();

    const { searchParams } = new URL(request.url);
    const communityId = searchParams.get('communityId');
    const type = searchParams.get('type'); // 'contacts', 'incidents', 'alerts', 'watch'
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

    if (!communityId) {
      return NextResponse.json(
        { error: 'Community ID is required' },
        { status: 400 }
      );
    }

    // SECURITY: Verify community membership
    const isMember = await verifyCommunityMembership(db, userId, communityId);
    if (!isMember) {
      return NextResponse.json(
        { error: 'You are not a member of this community' },
        { status: 403 }
      );
    }

    let query = db.collection('hubEmergency').where('communityId', '==', communityId);

    if (type) {
      query = query.where('type', '==', type);
    }

    const snapshot = await query
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || null,
      updatedAt: doc.data().updatedAt?.toDate?.() || null,
      scheduledAt: doc.data().scheduledAt?.toDate?.() || null,
      expiresAt: doc.data().expiresAt?.toDate?.() || null
    }));

    return NextResponse.json({
      success: true,
      data,
      count: data.length
    });

  } catch (error) {
    logger.error('Error fetching emergency data', error);
    return NextResponse.json(
      { error: 'Failed to fetch emergency data' },
      { status: 500 }
    );
  }
}

// POST - Create emergency contact, incident report, alert, or watch schedule
export async function POST(request) {
  try {
    // SECURITY: Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const authenticatedUserId = authResult.userId;
    const db = getAdminFirestore();

    const data = await request.json();
    const {
      communityId,
      type, // 'contact', 'incident', 'alert', 'watch'
      title,
      description,
      reporterUserId,
      reporterName,
      priority = 'medium', // low, medium, high, critical
      status = 'active',
      isAnonymous = false,
      location,
      contactInfo = {},
      incidentData = {},
      alertData = {},
      watchData = {},
      metadata = {}
    } = data;

    // Validate required fields
    if (!communityId || !type || !title) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // SECURITY: Verify community membership
    const isMember = await verifyCommunityMembership(db, authenticatedUserId, communityId);
    if (!isMember) {
      return NextResponse.json(
        { error: 'You are not a member of this community' },
        { status: 403 }
      );
    }

    // Validate type
    const validTypes = ['contact', 'incident', 'alert', 'watch'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid emergency type' },
        { status: 400 }
      );
    }

    let emergencyData = {
      communityId,
      type,
      title,
      description: description || '',
      priority,
      status,
      location: location || '',
      metadata,
      createdBy: authenticatedUserId, // Use authenticated user ID
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Add type-specific data
    switch (type) {
      case 'contact':
        emergencyData = {
          ...emergencyData,
          contactType: contactInfo.type || 'general',
          phoneNumber: contactInfo.phoneNumber || '',
          alternatePhone: contactInfo.alternatePhone || '',
          email: contactInfo.email || '',
          address: contactInfo.address || '',
          availability: contactInfo.availability || '24/7',
          isVerified: contactInfo.isVerified || false,
          isEmergencyOnly: contactInfo.isEmergencyOnly || true
        };
        break;

      case 'incident':
        emergencyData = {
          ...emergencyData,
          reporterUserId: isAnonymous ? null : authenticatedUserId, // Use authenticated user
          reporterName: isAnonymous ? 'Anonymous' : reporterName,
          incidentType: incidentData.type || 'general',
          dateOccurred: incidentData.dateOccurred ? new Date(incidentData.dateOccurred) : new Date(),
          witnesses: incidentData.witnesses || [],
          evidence: incidentData.evidence || [],
          isResolved: false,
          resolvedAt: null,
          followUpRequired: incidentData.followUpRequired || false,
          policeReported: incidentData.policeReported || false,
          policeReportNumber: incidentData.policeReportNumber || ''
        };
        break;

      case 'alert':
        emergencyData = {
          ...emergencyData,
          alertType: alertData.type || 'general',
          severity: alertData.severity || priority,
          isActive: true,
          broadcastToAll: alertData.broadcastToAll || false,
          targetAudience: alertData.targetAudience || [],
          expiresAt: alertData.expiresAt ? new Date(alertData.expiresAt) : null,
          actionRequired: alertData.actionRequired || false,
          actionDeadline: alertData.actionDeadline ? new Date(alertData.actionDeadline) : null,
          acknowledgmentRequired: alertData.acknowledgmentRequired || false,
          acknowledgedBy: []
        };
        break;

      case 'watch':
        emergencyData = {
          ...emergencyData,
          watchType: watchData.type || 'security',
          coordinatorUserId: authenticatedUserId, // Use authenticated user
          coordinatorName: watchData.coordinatorName || reporterName,
          scheduledAt: watchData.scheduledAt ? new Date(watchData.scheduledAt) : null,
          duration: watchData.duration || 60,
          participants: watchData.participants || [],
          maxParticipants: watchData.maxParticipants || 10,
          isRecurring: watchData.isRecurring || false,
          recurrencePattern: watchData.recurrencePattern || null,
          route: watchData.route || '',
          checkpoints: watchData.checkpoints || [],
          equipment: watchData.equipment || []
        };
        break;
    }

    const docRef = await db.collection('hubEmergency').add(emergencyData);

    return NextResponse.json({
      success: true,
      data: {
        id: docRef.id,
        ...emergencyData
      }
    }, { status: 201 });

  } catch (error) {
    logger.error('Error creating emergency record', error);
    return NextResponse.json(
      { error: 'Failed to create emergency record' },
      { status: 500 }
    );
  }
}

// PUT - Update emergency record
export async function PUT(request) {
  try {
    // SECURITY: Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const authenticatedUserId = authResult.userId;
    const db = getAdminFirestore();

    const data = await request.json();
    const {
      recordId,
      action, // 'update_status', 'acknowledge', 'join_watch', 'resolve_incident'
      ...updates
    } = data;

    if (!recordId || !action) {
      return NextResponse.json(
        { error: 'Record ID and action are required' },
        { status: 400 }
      );
    }

    const recordRef = db.collection('hubEmergency').doc(recordId);
    const recordDoc = await recordRef.get();

    if (!recordDoc.exists) {
      return NextResponse.json(
        { error: 'Emergency record not found' },
        { status: 404 }
      );
    }

    const recordData = recordDoc.data();

    // SECURITY: Verify community membership
    const isMember = await verifyCommunityMembership(db, authenticatedUserId, recordData.communityId);
    if (!isMember) {
      return NextResponse.json(
        { error: 'You are not a member of this community' },
        { status: 403 }
      );
    }

    let updateData = { updatedAt: new Date() };

    switch (action) {
      case 'acknowledge':
        if (recordData.type === 'alert') {
          updateData.acknowledgedBy = [
            ...(recordData.acknowledgedBy || []),
            {
              userId: authenticatedUserId, // Use verified user ID
              userName: authResult.user?.name || 'Member',
              acknowledgedAt: new Date()
            }
          ];
        }
        break;

      case 'join_watch':
        if (recordData.type === 'watch') {
          if (recordData.participants.length < recordData.maxParticipants) {
            updateData.participants = [
              ...recordData.participants,
              {
                userId: authenticatedUserId, // Use verified user ID
                userName: authResult.user?.name || 'Member',
                joinedAt: new Date(),
                role: 'member'
              }
            ];
          }
        }
        break;

      case 'resolve_incident':
        if (recordData.type === 'incident') {
          // SECURITY: Only reporter or admin can resolve
          if (recordData.reporterUserId !== authenticatedUserId && recordData.createdBy !== authenticatedUserId) {
            return NextResponse.json(
              { error: 'Only the reporter can resolve this incident' },
              { status: 403 }
            );
          }
          updateData.isResolved = true;
          updateData.resolvedAt = new Date();
          updateData.status = 'resolved';
          updateData.resolvedBy = authenticatedUserId;
        }
        break;

      case 'update_status':
        // SECURITY: Only creator can update status
        if (recordData.createdBy !== authenticatedUserId) {
          return NextResponse.json(
            { error: 'Only the creator can update this record' },
            { status: 403 }
          );
        }
        updateData = { ...updateData, ...updates };
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    await recordRef.update(updateData);

    const updatedDoc = await recordRef.get();
    const updatedData = updatedDoc.data();

    return NextResponse.json({
      success: true,
      data: {
        id: recordId,
        ...updatedData,
        createdAt: updatedData.createdAt?.toDate?.() || null,
        updatedAt: updatedData.updatedAt?.toDate?.() || null,
        scheduledAt: updatedData.scheduledAt?.toDate?.() || null,
        expiresAt: updatedData.expiresAt?.toDate?.() || null
      }
    });

  } catch (error) {
    logger.error('Error updating emergency record', error);
    return NextResponse.json(
      { error: 'Failed to update emergency record' },
      { status: 500 }
    );
  }
}

// DELETE - Delete emergency record (limited access)
export async function DELETE(request) {
  try {
    // SECURITY: Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const authenticatedUserId = authResult.userId;
    const db = getAdminFirestore();

    const { searchParams } = new URL(request.url);
    const recordId = searchParams.get('recordId');

    if (!recordId) {
      return NextResponse.json(
        { error: 'Record ID is required' },
        { status: 400 }
      );
    }

    const recordRef = db.collection('hubEmergency').doc(recordId);
    const recordDoc = await recordRef.get();

    if (!recordDoc.exists) {
      return NextResponse.json(
        { error: 'Emergency record not found' },
        { status: 404 }
      );
    }

    const recordData = recordDoc.data();

    // SECURITY: Verify community membership
    const isMember = await verifyCommunityMembership(db, authenticatedUserId, recordData.communityId);
    if (!isMember) {
      return NextResponse.json(
        { error: 'You are not a member of this community' },
        { status: 403 }
      );
    }

    // SECURITY: Only allow deletion by the creator
    if (recordData.createdBy !== authenticatedUserId && recordData.reporterUserId !== authenticatedUserId) {
      return NextResponse.json(
        { error: 'Only the creator can delete this record' },
        { status: 403 }
      );
    }

    // Soft delete for audit trail
    await recordRef.update({
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: authenticatedUserId
    });

    return NextResponse.json({
      success: true,
      message: 'Emergency record deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting emergency record', error);
    return NextResponse.json(
      { error: 'Failed to delete emergency record' },
      { status: 500 }
    );
  }
}
