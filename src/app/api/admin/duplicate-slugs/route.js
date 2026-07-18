export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth-middleware';

export async function GET(request) {
  try {
    // SECURITY: Verify admin authentication - MANDATORY
    const adminResult = await isAdmin(request);
    if (!adminResult.success) {
      return adminResult.error;
    }

    const db = getAdminFirestore();
    
    // Get all properties
    const snapshot = await db.collection('properties')
      .where('status', '==', 'active')
      .get();
    
    // Group by slug
    const slugGroups = {};
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const slug = data.slug || '';
      
      if (!slugGroups[slug]) {
        slugGroups[slug] = [];
      }
      
      slugGroups[slug].push({
        id: doc.id,
        title: data.title,
        location: data.location,
        createdAt: data.createdAt?.toDate().toISOString()
      });
    });
    
    // Find duplicates
    const duplicates = Object.keys(slugGroups)
      .filter(slug => slugGroups[slug].length > 1)
      .map(slug => ({
        slug,
        count: slugGroups[slug].length,
        properties: slugGroups[slug]
      }))
      .sort((a, b) => b.count - a.count);
    
    return NextResponse.json({
      success: true,
      duplicates,
      total: duplicates.reduce((sum, group) => sum + group.count, 0)
    });
    
  } catch (error) {
    console.error('Error finding duplicate slugs:', error);
    return NextResponse.json(
      { error: 'Failed to find duplicate slugs' },
      { status: 500 }
    );
  }
}