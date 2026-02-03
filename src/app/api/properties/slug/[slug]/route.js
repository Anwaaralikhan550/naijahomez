import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { fixListingEncoding } from '@/utils/fixEncoding';

// GET - Fetch a property by slug
export async function GET(request, { params }) {
  try {
    const { slug } = params;
    console.log('Looking for property with slug:', slug);
    
    const db = getAdminFirestore();
    
    // Query by slug
    const snapshot = await db.collection('properties')
      .where('slug', '==', slug)
      .where('status', '==', 'active')
      .limit(1)
      .get();
      
    console.log('Found properties:', snapshot.size);
    
    if (snapshot.empty) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      );
    }
    
    const doc = snapshot.docs[0];
    const data = doc.data();
    
    // Get similar properties efficiently
    const similarQuery = db.collection('properties')
      .where('status', '==', 'active')
      .where('propertyType', '==', data.propertyType || 'house')
      .where('listingType', '==', data.listingType || 'rent')
      .orderBy('createdAt', 'desc')
      .limit(4);
    
    const similarSnapshot = await similarQuery.get();
    const similarProperties = [];
    
    similarSnapshot.forEach(similarDoc => {
      if (similarDoc.id !== doc.id) {
        const similarData = similarDoc.data();
        similarProperties.push({
          id: similarDoc.id,
          ...similarData,
          createdAt: similarData.createdAt?.toDate().toISOString(),
          updatedAt: similarData.updatedAt?.toDate().toISOString()
        });
      }
    });
    
    return NextResponse.json({
      success: true,
      data: fixListingEncoding({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate().toISOString(),
        updatedAt: data.updatedAt?.toDate().toISOString()
      }),
      similar: similarProperties.slice(0, 3).map(fixListingEncoding)
    });
    
  } catch (error) {
    console.error('Error fetching property by slug:', error);
    return NextResponse.json(
      { error: 'Failed to fetch property' },
      { status: 500 }
    );
  }
}