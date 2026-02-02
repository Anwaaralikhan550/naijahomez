import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import cache from '@/lib/cache';

export async function POST(request) {
  try {
    console.log('Fix slug API called');
    
    // Get request body first
    const { propertyId, newSlug, oldSlug, userId } = await request.json();
    console.log('Request data:', { propertyId, newSlug, oldSlug, userId });
    
    // Simple validation - if userId is provided, use it
    if (!userId || userId.length < 5) {
      console.log('Invalid or missing userId');
      return NextResponse.json(
        { error: 'User authentication required' },
        { status: 401 }
      );
    }
    
    if (!propertyId || !newSlug) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    console.log('Getting Firestore instance...');
    const db = getAdminFirestore();
    
    console.log('Updating property:', propertyId);
    // Update the property
    await db.collection('properties').doc(propertyId).update({
      slug: newSlug,
      updatedAt: new Date()
    });
    
    console.log('Property updated successfully');
    
    // Clear relevant caches
    cache.clear();
    
    return NextResponse.json({
      success: true,
      propertyId,
      oldSlug,
      newSlug,
      message: 'Slug updated successfully'
    });
    
  } catch (error) {
    console.error('Error fixing slug:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { error: `Failed to update slug: ${error.message}` },
      { status: 500 }
    );
  }
}