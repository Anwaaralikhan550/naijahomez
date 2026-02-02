import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth-middleware';

export async function GET(request) {
  try {
    // SECURITY: Verify admin authentication
    const adminResult = await isAdmin(request);
    if (!adminResult.success) {
      return adminResult.error;
    }

    const db = getAdminFirestore();

    // Check total properties by listing type
    const allSnapshot = await db.collection('properties').limit(100).orderBy('createdAt', 'desc').get();

    const stats = {
      total: allSnapshot.size,
      byListingType: { rent: 0, sale: 0, undefined: 0 },
      byStatus: { active: 0, inactive: 0, undefined: 0 },
      examples: { rent: [], sale: [] }
    };

    allSnapshot.forEach(doc => {
      const data = doc.data();

      // Count by listingType
      if (data.listingType === 'rent') {
        stats.byListingType.rent++;
        if (stats.examples.rent.length < 3) {
          stats.examples.rent.push({
            id: doc.id,
            title: data.title,
            listingType: data.listingType,
            status: data.status
          });
        }
      } else if (data.listingType === 'sale') {
        stats.byListingType.sale++;
        if (stats.examples.sale.length < 3) {
          stats.examples.sale.push({
            id: doc.id,
            title: data.title,
            listingType: data.listingType,
            status: data.status
          });
        }
      } else {
        stats.byListingType.undefined++;
      }

      // Count by status
      if (data.status === 'active') stats.byStatus.active++;
      else if (data.status === 'inactive') stats.byStatus.inactive++;
      else stats.byStatus.undefined++;
    });

    return NextResponse.json({
      success: true,
      message: 'First 100 properties analysis',
      stats
    });

  } catch (error) {
    console.error('Error checking rent properties:', error);
    return NextResponse.json(
      { error: 'Failed to check rent properties', details: error.message },
      { status: 500 }
    );
  }
}
