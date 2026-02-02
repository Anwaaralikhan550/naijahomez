import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth-middleware';

export async function POST(request) {
  try {
    // SECURITY: Verify admin authentication
    const adminResult = await isAdmin(request);
    if (!adminResult.success) {
      return adminResult.error;
    }

    const db = getAdminFirestore();

    console.log('🔧 Starting listingType fix...');

    // Get all properties
    const snapshot = await db.collection('properties').get();
    const totalProperties = snapshot.size;

    console.log(`📍 Found ${totalProperties} properties to process`);

    let updated = 0;
    let alreadyCorrect = 0;
    let errors = 0;

    // Process in batches of 500
    const BATCH_SIZE = 500;
    const propertiesToUpdate = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      const title = (data.title || '').toLowerCase();
      const currentListingType = data.listingType;

      // Determine correct listing type from title
      let correctListingType = null;
      if (title.includes('for rent') || title.includes('to let')) {
        correctListingType = 'rent';
      } else if (title.includes('for sale') || title.includes('to buy')) {
        correctListingType = 'sale';
      }

      // If we can determine the type and it's different from current
      if (correctListingType && currentListingType !== correctListingType) {
        propertiesToUpdate.push({
          id: doc.id,
          currentListingType,
          correctListingType,
          title: data.title
        });
      } else if (correctListingType === currentListingType) {
        alreadyCorrect++;
      }
    });

    console.log(`📊 Analysis:`);
    console.log(`  - Already correct: ${alreadyCorrect}`);
    console.log(`  - Need updating: ${propertiesToUpdate.length}`);

    if (propertiesToUpdate.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All listing types are already correct!',
        stats: {
          total: totalProperties,
          updated: 0,
          alreadyCorrect,
          errors: 0
        }
      });
    }

    // Update in batches
    for (let i = 0; i < propertiesToUpdate.length; i += BATCH_SIZE) {
      const batchItems = propertiesToUpdate.slice(i, i + BATCH_SIZE);
      const batch = db.batch();

      batchItems.forEach(prop => {
        const docRef = db.collection('properties').doc(prop.id);
        batch.update(docRef, {
          listingType: prop.correctListingType,
          updatedAt: new Date()
        });
      });

      try {
        await batch.commit();
        updated += batchItems.length;
        console.log(`✅ Updated batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batchItems.length} properties`);
      } catch (error) {
        errors += batchItems.length;
        console.error(`❌ Batch failed:`, error);
      }
    }

    console.log(`✅ ListingType fix completed!`);
    console.log(`   Updated: ${updated}/${propertiesToUpdate.length}`);

    return NextResponse.json({
      success: true,
      message: `Fixed ${updated} listing types!`,
      stats: {
        total: totalProperties,
        updated,
        alreadyCorrect,
        errors,
        examples: propertiesToUpdate.slice(0, 5).map(p => ({
          title: p.title,
          was: p.currentListingType || 'undefined',
          now: p.correctListingType
        }))
      }
    });

  } catch (error) {
    console.error('Error fixing listing types:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fix listing types',
        details: error.message
      },
      { status: 500 }
    );
  }
}
