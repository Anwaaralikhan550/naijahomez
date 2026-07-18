export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAdminFirestore, initAdmin } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import { isUserActiveCommunityMember } from '@/lib/hubFirestore';

// Initialize admin SDK
initAdmin();

const db = getAdminFirestore();

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

async function ensureMembership(userId, communityId) {
  const isMember = await isUserActiveCommunityMember(userId, communityId);
  if (!isMember) {
    return errorResponse('You are not a member of this community', 'FORBIDDEN', 403);
  }
  return null;
}

// GET - Fetch smart services for a community
export async function GET(request) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authFailureResponse(authResult.error);
    }

    const authenticatedUserId = authResult.userId;
    const { searchParams } = new URL(request.url);
    const communityId = searchParams.get('communityId');
    const serviceType = searchParams.get('type'); // generator, water, security, internet
    
    if (!communityId) {
      return errorResponse('Community ID is required', 'VALIDATION_ERROR', 400);
    }

    const membershipError = await ensureMembership(authenticatedUserId, communityId);
    if (membershipError) {
      return membershipError;
    }

    let snapshot;
    try {
      // Try with orderBy first
      snapshot = await db.collection('hubSmartServices')
        .where('communityId', '==', communityId)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();
    } catch (indexError) {
      console.log('Index not available, falling back to simple query:', indexError.message);
      // Fallback without orderBy if index doesn't exist
      snapshot = await db.collection('hubSmartServices')
        .where('communityId', '==', communityId)
        .limit(50)
        .get();
    }
    
    let services = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || null,
      updatedAt: doc.data().updatedAt?.toDate?.() || null,
      scheduledAt: doc.data().scheduledAt?.toDate?.() || null
    }));

    // Filter by service type if specified (client-side filter to avoid index requirements)
    if (serviceType) {
      services = services.filter(service => service.type === serviceType);
    }

    return NextResponse.json({
      success: true,
      data: services,
      count: services.length
    });

  } catch (error) {
    console.error('Error fetching smart services:', error);
    return NextResponse.json(
      { error: 'Failed to fetch smart services' },
      { status: 500 }
    );
  }
}

// POST - Create new smart service request
export async function POST(request) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authFailureResponse(authResult.error);
    }

    const authenticatedUserId = authResult.userId;
    const data = await request.json();
    const {
      communityId,
      type, // 'generator', 'water', 'security', 'internet'
      title,
      description,
      requesterName,
      requesterContact,
      scheduledAt,
      maxParticipants,
      estimatedCost,
      costPerParticipant,
      metadata = {} // Additional data specific to service type
    } = data;

    // Validate required fields
    if (!communityId || !type || !title) {
      return errorResponse('Missing required fields', 'VALIDATION_ERROR', 400);
    }

    const membershipError = await ensureMembership(authenticatedUserId, communityId);
    if (membershipError) {
      return membershipError;
    }

    // Validate service type
    const validTypes = ['generator', 'water', 'security', 'internet'];
    if (!validTypes.includes(type)) {
      return errorResponse('Invalid service type', 'VALIDATION_ERROR', 400);
    }

    const serviceData = {
      communityId,
      type,
      title,
      description: description || '',
      requesterUserId: authenticatedUserId,
      requesterName: requesterName || 'Anonymous',
      requesterContact: requesterContact || '',
      status: 'open', // open, in-progress, completed, cancelled
      participants: [],
      maxParticipants: maxParticipants || 10,
      currentParticipants: 0,
      estimatedCost: estimatedCost || 0,
      costPerParticipant: costPerParticipant || 0,
      actualCost: 0,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      metadata,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await db.collection('hubSmartServices').add(serviceData);
    
    return NextResponse.json({
      success: true,
      data: {
        id: docRef.id,
        ...serviceData
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating smart service:', error);
    return NextResponse.json(
      { error: 'Failed to create smart service' },
      { status: 500 }
    );
  }
}

// PUT - Update smart service (join/leave, update status, etc.)
export async function PUT(request) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authFailureResponse(authResult.error);
    }

    const authenticatedUserId = authResult.userId;
    const data = await request.json();
    const {
      serviceId,
      action, // 'join', 'leave', 'update_status', 'update_cost'
      userName,
      userContact,
      newStatus,
      actualCost,
      ...otherUpdates
    } = data;

    if (!serviceId || !action) {
      return errorResponse('Service ID and action are required', 'VALIDATION_ERROR', 400);
    }

    const serviceRef = db.collection('hubSmartServices').doc(serviceId);
    const serviceDoc = await serviceRef.get();
    
    if (!serviceDoc.exists) {
      return errorResponse('Service not found', 'NOT_FOUND', 404);
    }

    const serviceData = serviceDoc.data();
    const membershipError = await ensureMembership(authenticatedUserId, serviceData.communityId);
    if (membershipError) {
      return membershipError;
    }

    let updateData = { updatedAt: new Date() };

    switch (action) {
      case 'join':
        // Check if user already joined
        if (serviceData.participants.some(p => p.userId === authenticatedUserId)) {
          return errorResponse('User already joined this service', 'VALIDATION_ERROR', 400);
        }
        
        // Check if service is full
        if (serviceData.currentParticipants >= serviceData.maxParticipants) {
          return errorResponse('Service is full', 'VALIDATION_ERROR', 400);
        }

        updateData.participants = [
          ...serviceData.participants,
          {
            userId: authenticatedUserId,
            userName: userName || 'Anonymous',
            userContact: userContact || '',
            joinedAt: new Date()
          }
        ];
        updateData.currentParticipants = serviceData.currentParticipants + 1;
        break;

      case 'leave':
        updateData.participants = serviceData.participants.filter(p => p.userId !== authenticatedUserId);
        if (serviceData.participants.length === updateData.participants.length) {
          return errorResponse('User has not joined this service', 'VALIDATION_ERROR', 400);
        }
        updateData.currentParticipants = Math.max(0, serviceData.currentParticipants - 1);
        break;

      case 'update_status':
        if (serviceData.requesterUserId !== authenticatedUserId) {
          return errorResponse('Only the service creator can update status', 'FORBIDDEN', 403);
        }

        if (!newStatus || !['open', 'in-progress', 'completed', 'cancelled'].includes(newStatus)) {
          return errorResponse('Invalid status', 'VALIDATION_ERROR', 400);
        }
        updateData.status = newStatus;
        break;

      case 'update_cost':
        if (serviceData.requesterUserId !== authenticatedUserId) {
          return errorResponse('Only the service creator can update cost', 'FORBIDDEN', 403);
        }

        if (actualCost !== undefined) {
          updateData.actualCost = actualCost;
          updateData.costPerParticipant = serviceData.currentParticipants > 0 
            ? actualCost / serviceData.currentParticipants 
            : 0;
        }
        break;

      default:
        // Generic update
        updateData = { ...updateData, ...otherUpdates };
        break;
    }

    await serviceRef.update(updateData);

    const updatedDoc = await serviceRef.get();
    const updatedData = updatedDoc.data();

    return NextResponse.json({
      success: true,
      data: {
        id: serviceId,
        ...updatedData,
        createdAt: updatedData.createdAt?.toDate?.() || null,
        updatedAt: updatedData.updatedAt?.toDate?.() || null,
        scheduledAt: updatedData.scheduledAt?.toDate?.() || null
      }
    });

  } catch (error) {
    console.error('Error updating smart service:', error);
    return NextResponse.json(
      { error: 'Failed to update smart service' },
      { status: 500 }
    );
  }
}

// DELETE - Delete smart service (only by creator or admin)
export async function DELETE(request) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authFailureResponse(authResult.error);
    }

    const authenticatedUserId = authResult.userId;
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get('serviceId');
    
    if (!serviceId) {
      return errorResponse('Service ID is required', 'VALIDATION_ERROR', 400);
    }

    const serviceRef = db.collection('hubSmartServices').doc(serviceId);
    const serviceDoc = await serviceRef.get();
    
    if (!serviceDoc.exists) {
      return errorResponse('Service not found', 'NOT_FOUND', 404);
    }

    const serviceData = serviceDoc.data();
    const membershipError = await ensureMembership(authenticatedUserId, serviceData.communityId);
    if (membershipError) {
      return membershipError;
    }
    
    // Only allow deletion by the requester
    if (serviceData.requesterUserId !== authenticatedUserId) {
      return errorResponse('Only the service creator can delete this service', 'FORBIDDEN', 403);
    }

    await serviceRef.delete();

    return NextResponse.json({
      success: true,
      message: 'Smart service deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting smart service:', error);
    return NextResponse.json(
      { error: 'Failed to delete smart service' },
      { status: 500 }
    );
  }
}
