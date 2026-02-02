import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';

// GET - Fetch a housemate listing by slug
export async function GET(request, { params }) {
  try {
    const { slug } = params;
    
    const db = getAdminFirestore();
    
    // Query by slug
    const snapshot = await db.collection('housemate')
      .where('slug', '==', slug)
      .where('status', '==', 'active')
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return NextResponse.json(
        { error: 'Housemate listing not found' },
        { status: 404 }
      );
    }
    
    const doc = snapshot.docs[0];
    const data = doc.data();
    
    // Get similar housemate listings efficiently
    const similarQuery = db.collection('housemate')
      .where('status', '==', 'active')
      .where('gender', '==', data.gender || 'any')
      .orderBy('createdAt', 'desc')
      .limit(4);
    
    const similarSnapshot = await similarQuery.get();
    const similarHousemates = [];
    
    similarSnapshot.forEach(similarDoc => {
      if (similarDoc.id !== doc.id) {
        const similarData = similarDoc.data();
        similarHousemates.push({
          id: similarDoc.id,
          ...similarData,
          createdAt: similarData.createdAt?.toDate().toISOString(),
          updatedAt: similarData.updatedAt?.toDate().toISOString()
        });
      }
    });
    
    return NextResponse.json({
      success: true,
      data: {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate().toISOString(),
        updatedAt: data.updatedAt?.toDate().toISOString()
      },
      similar: similarHousemates.slice(0, 3)
    });
    
  } catch (error) {
    console.error('Error fetching housemate listing by slug:', error);
    return NextResponse.json(
      { error: 'Failed to fetch housemate listing' },
      { status: 500 }
    );
  }
}