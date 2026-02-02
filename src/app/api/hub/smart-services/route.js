import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '@/lib/firebase-admin';

// Initialize admin SDK
initAdmin();

const db = getFirestore();

// GET - Fetch smart services for a community
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const communityId = searchParams.get('communityId');
    const serviceType = searchParams.get('type'); // generator, water, security, internet
    
    if (!communityId) {
      return NextResponse.json(
        { error: 'Community ID is required' },
        { status: 400 }
      );
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
    const data = await request.json();
    const {
      communityId,
      type, // 'generator', 'water', 'security', 'internet'
      title,
      description,
      requesterUserId,
      requesterName,
      requesterContact,
      scheduledAt,
      maxParticipants,
      estimatedCost,
      costPerParticipant,
      metadata = {} // Additional data specific to service type
    } = data;

    // Validate required fields
    if (!communityId || !type || !title || !requesterUserId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate service type
    const validTypes = ['generator', 'water', 'security', 'internet'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid service type' },
        { status: 400 }
      );
    }

    const serviceData = {
      communityId,
      type,
      title,
      description: description || '',
      requesterUserId,
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
    const data = await request.json();
    const {
      serviceId,
      action, // 'join', 'leave', 'update_status', 'update_cost'
      userId,
      userName,
      userContact,
      newStatus,
      actualCost,
      ...otherUpdates
    } = data;

    if (!serviceId || !action) {
      return NextResponse.json(
        { error: 'Service ID and action are required' },
        { status: 400 }
      );
    }

    const serviceRef = db.collection('hubSmartServices').doc(serviceId);
    const serviceDoc = await serviceRef.get();
    
    if (!serviceDoc.exists) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      );
    }

    const serviceData = serviceDoc.data();
    let updateData = { updatedAt: new Date() };

    switch (action) {
      case 'join':
        if (!userId) {
          return NextResponse.json(
            { error: 'User ID required for join action' },
            { status: 400 }
          );
        }
        
        // Check if user already joined
        if (serviceData.participants.some(p => p.userId === userId)) {
          return NextResponse.json(
            { error: 'User already joined this service' },
            { status: 400 }
          );
        }
        
        // Check if service is full
        if (serviceData.currentParticipants >= serviceData.maxParticipants) {
          return NextResponse.json(
            { error: 'Service is full' },
            { status: 400 }
          );
        }

        updateData.participants = [
          ...serviceData.participants,
          {
            userId,
            userName: userName || 'Anonymous',
            userContact: userContact || '',
            joinedAt: new Date()
          }
        ];
        updateData.currentParticipants = serviceData.currentParticipants + 1;
        break;

      case 'leave':
        if (!userId) {
          return NextResponse.json(
            { error: 'User ID required for leave action' },
            { status: 400 }
          );
        }
        
        updateData.participants = serviceData.participants.filter(p => p.userId !== userId);
        updateData.currentParticipants = Math.max(0, serviceData.currentParticipants - 1);
        break;

      case 'update_status':
        if (!newStatus || !['open', 'in-progress', 'completed', 'cancelled'].includes(newStatus)) {
          return NextResponse.json(
            { error: 'Invalid status' },
            { status: 400 }
          );
        }
        updateData.status = newStatus;
        break;

      case 'update_cost':
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
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get('serviceId');
    const userId = searchParams.get('userId');
    
    if (!serviceId || !userId) {
      return NextResponse.json(
        { error: 'Service ID and User ID are required' },
        { status: 400 }
      );
    }

    const serviceRef = db.collection('hubSmartServices').doc(serviceId);
    const serviceDoc = await serviceRef.get();
    
    if (!serviceDoc.exists) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      );
    }

    const serviceData = serviceDoc.data();
    
    // Only allow deletion by the requester
    if (serviceData.requesterUserId !== userId) {
      return NextResponse.json(
        { error: 'Only the service creator can delete this service' },
        { status: 403 }
      );
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