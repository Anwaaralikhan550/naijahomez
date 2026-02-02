import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';

// GET - Fetch a noticeboard item by slug
export async function GET(request, { params }) {
  try {
    const { slug } = params;
    
    const db = getAdminFirestore();
    
    // Query by slug
    const snapshot = await db.collection('noticeboard')
      .where('slug', '==', slug)
      .where('status', '==', 'active')
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return NextResponse.json(
        { error: 'Noticeboard item not found' },
        { status: 404 }
      );
    }
    
    const doc = snapshot.docs[0];
    const data = doc.data();
    
    // Check if notice has expired
    if (data.expiresAt && new Date(data.expiresAt.toDate()) < new Date()) {
      return NextResponse.json(
        { error: 'Noticeboard item has expired' },
        { status: 410 }
      );
    }
    
    // Get similar notices efficiently
    const similarQuery = db.collection('noticeboard')
      .where('status', '==', 'active')
      .where('category', '==', data.category || 'general')
      .orderBy('createdAt', 'desc')
      .limit(4);
    
    const similarSnapshot = await similarQuery.get();
    const similarNotices = [];
    const now = new Date();
    
    similarSnapshot.forEach(similarDoc => {
      if (similarDoc.id !== doc.id) {
        const similarData = similarDoc.data();
        
        // Skip expired notices
        if (similarData.expiresAt && new Date(similarData.expiresAt.toDate()) < now) {
          return;
        }
        
        similarNotices.push({
          id: similarDoc.id,
          ...similarData,
          createdAt: similarData.createdAt?.toDate().toISOString(),
          updatedAt: similarData.updatedAt?.toDate().toISOString(),
          expiresAt: similarData.expiresAt?.toDate().toISOString()
        });
      }
    });
    
    return NextResponse.json({
      success: true,
      data: {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate().toISOString(),
        updatedAt: data.updatedAt?.toDate().toISOString(),
        expiresAt: data.expiresAt?.toDate().toISOString()
      },
      similar: similarNotices.slice(0, 3)
    });
    
  } catch (error) {
    console.error('Error fetching noticeboard item by slug:', error);
    return NextResponse.json(
      { error: 'Failed to fetch noticeboard item' },
      { status: 500 }
    );
  }
}