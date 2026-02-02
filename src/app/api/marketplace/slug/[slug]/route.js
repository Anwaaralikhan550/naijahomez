import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';

// GET - Fetch a marketplace item by slug
export async function GET(request, { params }) {
  try {
    const { slug } = params;
    console.log(`Marketplace API: Looking for slug "${slug}"`);
    
    const db = getAdminFirestore();
    
    // Query by slug (first try with status filter, then without)
    let snapshot = await db.collection('marketplace')
      .where('slug', '==', slug)
      .where('status', '==', 'active')
      .limit(1)
      .get();
    
    // If not found with active status, try without status filter
    if (snapshot.empty) {
      console.log(`No active item found for slug: ${slug}, trying without status filter`);
      snapshot = await db.collection('marketplace')
        .where('slug', '==', slug)
        .limit(1)
        .get();
    }
    
    if (snapshot.empty) {
      console.log(`No marketplace item found for slug: ${slug}`);
      return NextResponse.json(
        { error: 'Marketplace item not found' },
        { status: 404 }
      );
    }
    
    console.log(`Found marketplace item with slug: ${slug}`);
    
    const doc = snapshot.docs[0];
    const data = doc.data();
    
    // Get similar items efficiently
    const similarQuery = db.collection('marketplace')
      .where('status', '==', 'active')
      .where('category', '==', data.category || 'general')
      .orderBy('createdAt', 'desc')
      .limit(4);
    
    const similarSnapshot = await similarQuery.get();
    const similarItems = [];
    
    similarSnapshot.forEach(similarDoc => {
      if (similarDoc.id !== doc.id) {
        const similarData = similarDoc.data();
        similarItems.push({
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
      similar: similarItems.slice(0, 3)
    });
    
  } catch (error) {
    console.error('Error fetching marketplace item by slug:', error);
    return NextResponse.json(
      { error: 'Failed to fetch marketplace item' },
      { status: 500 }
    );
  }
}