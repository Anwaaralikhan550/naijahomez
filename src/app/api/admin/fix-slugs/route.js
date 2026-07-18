export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { generateDocumentSlug } from '@/utils/slugify';
import { isAdmin } from '@/lib/auth-middleware';

function errorResponse(message, code = 'INTERNAL_ERROR', status = 500) {
  return NextResponse.json({ success: false, error: message, code }, { status });
}

async function authFailureResponse(authError, fallbackCode = 'UNAUTHORIZED') {
  const status = authError?.status || 401;
  let message = status === 403 ? 'Forbidden' : status === 503 ? 'Authentication service unavailable' : 'Unauthorized';

  try {
    const payload = await authError.clone().json();
    if (typeof payload?.error === 'string' && payload.error.trim()) {
      message = payload.error;
    }
  } catch {
    // Keep fallback message.
  }

  const code =
    status === 401 ? 'UNAUTHORIZED' :
    status === 403 ? 'FORBIDDEN' :
    status === 404 ? 'NOT_FOUND' :
    status === 503 ? 'SERVICE_UNAVAILABLE' :
    fallbackCode;

  return errorResponse(message, code, status);
}



// POST - Fix all duplicate slugs (Admin only)
export async function POST(request) {
  try {
    // SECURITY: Verify admin authentication
    const adminResult = await isAdmin(request);
    if (!adminResult.success) {
      return authFailureResponse(adminResult.error, 'FORBIDDEN');
    }

    const db = getAdminFirestore();

    console.log('🔧 Starting slug fix...');

    // Get all properties
    const snapshot = await db.collection('properties').get();
    const totalProperties = snapshot.size;

    console.log(`📍 Found ${totalProperties} properties to process`);

    // Track slugs and properties needing updates
    const slugCounts = {};
    const propertiesToUpdate = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      const currentSlug = data.slug || '';
      const expectedSlug = generateDocumentSlug(data.title || 'property', doc.id);

      // Count slug usage
      slugCounts[currentSlug] = (slugCounts[currentSlug] || 0) + 1;

      // Check if slug needs updating
      if (currentSlug !== expectedSlug || !currentSlug) {
        propertiesToUpdate.push({
          id: doc.id,
          title: data.title || 'Untitled Property',
          currentSlug,
          expectedSlug,
          isDuplicate: false
        });
      }
    });

    // Mark duplicates
    propertiesToUpdate.forEach(prop => {
      prop.isDuplicate = slugCounts[prop.currentSlug] > 1;
    });

    const duplicates = propertiesToUpdate.filter(p => p.isDuplicate);
    const needsUpdate = propertiesToUpdate.length;

    console.log(`📊 Analysis:`);
    console.log(`  - Properties needing updates: ${needsUpdate}`);
    console.log(`  - Duplicate slugs to fix: ${duplicates.length}`);

    if (needsUpdate === 0) {
      return NextResponse.json({
        success: true,
        message: 'All slugs are already unique!',
        stats: {
          total: totalProperties,
          updated: 0,
          duplicates: 0
        }
      });
    }

    // Update in batches (500 at a time for Firestore batch limit)
    const BATCH_SIZE = 500;
    let updated = 0;
    let errors = 0;

    for (let i = 0; i < propertiesToUpdate.length; i += BATCH_SIZE) {
      const batchItems = propertiesToUpdate.slice(i, i + BATCH_SIZE);
      const batch = db.batch();

      batchItems.forEach(prop => {
        const docRef = db.collection('properties').doc(prop.id);
        batch.update(docRef, {
          slug: prop.expectedSlug,
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

    console.log(`✅ Slug fix completed!`);
    console.log(`   Updated: ${updated}/${needsUpdate}`);

    // Verify no duplicates remain
    const verifySnapshot = await db.collection('properties').get();
    const finalSlugs = {};

    verifySnapshot.forEach(doc => {
      const slug = doc.data().slug;
      if (slug) {
        finalSlugs[slug] = (finalSlugs[slug] || 0) + 1;
      }
    });

    const remainingDuplicates = Object.keys(finalSlugs).filter(slug => finalSlugs[slug] > 1);

    return NextResponse.json({
      success: true,
      message: remainingDuplicates.length === 0
        ? 'All slugs are now unique!'
        : `Fixed ${updated} slugs, but ${remainingDuplicates.length} duplicates remain`,
      stats: {
        total: totalProperties,
        updated,
        errors,
        duplicatesFixed: duplicates.length,
        remainingDuplicates: remainingDuplicates.length
      }
    });

  } catch (error) {
    console.error('Error fixing slugs:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fix slugs',
        code: 'SLUG_FIX_FAILED',
        details: error.message
      },
      { status: 500 }
    );
  }
}

// GET - Check for duplicate slugs (without fixing)
export async function GET(request) {
  try {
    // SECURITY: Verify admin authentication
    const adminResult = await isAdmin(request);
    if (!adminResult.success) {
      return authFailureResponse(adminResult.error, 'FORBIDDEN');
    }

    const db = getAdminFirestore();

    const snapshot = await db.collection('properties').get();
    const slugCounts = {};

    snapshot.forEach(doc => {
      const slug = doc.data().slug || 'no-slug';
      slugCounts[slug] = (slugCounts[slug] || 0) + 1;
    });

    const duplicates = Object.entries(slugCounts)
      .filter(([slug, count]) => count > 1)
      .map(([slug, count]) => ({ slug, count }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      success: true,
      totalProperties: snapshot.size,
      duplicateSlugs: duplicates.length,
      affectedProperties: duplicates.reduce((sum, d) => sum + d.count, 0),
      examples: duplicates.slice(0, 10)
    });

  } catch (error) {
    console.error('Error checking slugs:', error);
    return errorResponse('Failed to check slugs', 'INTERNAL_ERROR', 500);
  }
}
