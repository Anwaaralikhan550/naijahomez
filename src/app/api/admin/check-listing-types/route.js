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

    // Get first 100 properties to analyze
    const snapshot = await db.collection('properties').limit(100).get();

    const stats = {
      total: snapshot.size,
      listingTypes: {},
      examples: []
    };

    snapshot.forEach(doc => {
      const data = doc.data();
      const lt = data.listingType || 'undefined';

      stats.listingTypes[lt] = (stats.listingTypes[lt] || 0) + 1;

      if (stats.examples.length < 10) {
        stats.examples.push({
          id: doc.id,
          title: data.title?.substring(0, 50),
          listingType: data.listingType,
          rate: data.rate?.substring(0, 30)
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Listing types analysis (first 100 properties)',
      stats
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
