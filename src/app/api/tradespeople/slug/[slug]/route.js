import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';

// GET - Fetch a service/tradesperson by slug
export async function GET(request, { params }) {
  try {
    const { slug } = params;
    
    const db = getAdminFirestore();
    
    // Query by slug
    const snapshot = await db.collection('services')
      .where('slug', '==', slug)
      .where('status', '==', 'active')
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      );
    }
    
    const doc = snapshot.docs[0];
    const data = doc.data();
    
    // Get similar services efficiently (fallback to simple query if serviceType filtering fails)
    let similarQuery;
    try {
      if (data.serviceType) {
        similarQuery = db.collection('services')
          .where('status', '==', 'active')
          .where('serviceType', '==', data.serviceType)
          .orderBy('createdAt', 'desc')
          .limit(4);
      } else {
        similarQuery = db.collection('services')
          .where('status', '==', 'active')
          .orderBy('createdAt', 'desc')
          .limit(4);
      }
    } catch (error) {
      // Fallback to simple query without serviceType filter
      similarQuery = db.collection('services')
        .where('status', '==', 'active')
        .orderBy('createdAt', 'desc')
        .limit(4);
    }
    
    const similarServices = [];
    
    try {
      const similarSnapshot = await similarQuery.get();
      
      similarSnapshot.forEach(similarDoc => {
        if (similarDoc.id !== doc.id) {
          const similarData = similarDoc.data();
          similarServices.push({
            id: similarDoc.id,
            ...similarData,
            createdAt: similarData.createdAt?.toDate().toISOString(),
            updatedAt: similarData.updatedAt?.toDate().toISOString()
          });
        }
      });
    } catch (error) {
      console.warn('Error fetching similar services:', error);
      // Continue without similar services
    }
    
    return NextResponse.json({
      success: true,
      data: {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate().toISOString(),
        updatedAt: data.updatedAt?.toDate().toISOString()
      },
      similar: similarServices.slice(0, 3)
    });
    
  } catch (error) {
    console.error('Error fetching service by slug:', error);
    return NextResponse.json(
      { error: 'Failed to fetch service' },
      { status: 500 }
    );
  }
}