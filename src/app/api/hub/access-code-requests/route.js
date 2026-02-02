import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth, isAdmin } from '@/lib/auth-middleware';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const communityId = searchParams.get('communityId');

    if (!communityId) {
      return NextResponse.json(
        { error: 'Community ID is required' },
        { status: 400 }
      );
    }

    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    // Initialize admin SDK
    const db = getAdminFirestore();

    // Check if user is admin
    const isUserAdmin = await isAdmin(authResult.userId);
    if (!isUserAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Get access code requests using Admin SDK syntax
    const requestsSnapshot = await db.collection('hub_access_requests')
      .where('communityId', '==', communityId)
      .where('status', '==', 'pending')
      .orderBy('requestedAt', 'desc')
      .get();

    const requests = [];
    requestsSnapshot.forEach(doc => {
      requests.push({
        id: doc.id,
        ...doc.data(),
        requestedAt: doc.data().requestedAt?.toDate().toISOString()
      });
    });

    return NextResponse.json({ requests });

  } catch (error) {
    console.error('Error fetching access code requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch access code requests' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    const { communityId, name, email, phone, message } = data;

    if (!communityId || !name || !email) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Initialize admin SDK
    const db = getAdminFirestore();

    // Create access request
    const requestData = {
      communityId,
      name,
      email,
      phone: phone || '',
      message: message || '',
      status: 'pending',
      requestedAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await db.collection('hub_access_requests').add(requestData);

    return NextResponse.json({ 
      success: true,
      id: docRef.id 
    });

  } catch (error) {
    console.error('Error creating access code request:', error);
    return NextResponse.json(
      { error: 'Failed to create access code request' },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const data = await request.json();
    const { requestId, status, accessCode } = data;

    if (!requestId || !status) {
      return NextResponse.json(
        { error: 'Request ID and status are required' },
        { status: 400 }
      );
    }

    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    // Check if user is admin
    const isUserAdmin = await isAdmin(authResult.userId);
    if (!isUserAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Initialize admin SDK
    const db = getAdminFirestore();

    // Update request
    const updateData = {
      status,
      updatedAt: new Date(),
      updatedBy: authResult.userId
    };

    if (status === 'approved' && accessCode) {
      updateData.accessCode = accessCode;
      updateData.approvedAt = new Date();
    } else if (status === 'rejected') {
      updateData.rejectedAt = new Date();
    }

    await db.collection('hub_access_requests').doc(requestId).update(updateData);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error updating access code request:', error);
    return NextResponse.json(
      { error: 'Failed to update access code request' },
      { status: 500 }
    );
  }
}