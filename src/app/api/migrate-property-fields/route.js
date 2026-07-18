export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';

export async function POST() {
  try {
    console.log('🚀 Starting property field migration...');
    const db = getAdminFirestore();
    
    let totalProcessed = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    
    // Parse price string to numeric value
    function parsePrice(priceStr) {
      if (!priceStr) return null;
      
      let cleanPrice = priceStr
        .replace(/₦|N|\$|USD|NGN/gi, '')
        .replace(/,/g, '')
        .replace(/per annum|approx\.|per month/gi, '')
        .trim();
      
      const match = cleanPrice.match(/[\d,]+\.?\d*/);
      if (match) {
        const numStr = match[0].replace(/,/g, '');
        const num = parseFloat(numStr);
        return isNaN(num) ? null : num;
      }
      
      return null;
    }
    
    // Determine property type from title
    function determinePropertyType(title) {
      if (!title) return 'house';
      
      const titleLower = title.toLowerCase();
      
      if (titleLower.includes('flat') || titleLower.includes('apartment')) {
        return 'apartment';
      } else if (titleLower.includes('land') || titleLower.includes('plot')) {
        return 'land';
      } else if (titleLower.includes('duplex') || titleLower.includes('detached') || 
                 titleLower.includes('semi-detached') || titleLower.includes('terraced') ||
                 titleLower.includes('bungalow')) {
        return 'house';
      } else if (titleLower.includes('office') || titleLower.includes('shop') || 
                 titleLower.includes('commercial') || titleLower.includes('warehouse')) {
        return 'commercial';
      } else if (titleLower.includes('room') || titleLower.includes('mini flat') ||
                 titleLower.includes('self contain') || titleLower.includes('studio')) {
        return 'apartment';
      }
      
      if (titleLower.match(/\d+\s*bedroom/)) {
        return titleLower.includes('flat') ? 'apartment' : 'house';
      }
      
      return 'house';
    }
    
    // Process in batches
    let lastDoc = null;
    let batchCount = 0;
    
    while (true) {
      batchCount++;
      console.log(`Processing batch ${batchCount}...`);
      
      let propertyQuery = db.collection('properties').limit(200);
      if (lastDoc) {
        propertyQuery = propertyQuery.startAfter(lastDoc);
      }
      
      const snapshot = await propertyQuery.get();
      
      if (snapshot.empty) {
        console.log('No more properties to process');
        break;
      }
      
      const batch = db.batch();
      let batchUpdates = 0;
      
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const updates = {};
        let needsUpdate = false;
        
        totalProcessed++;
        
        // Fix propertyType field
        if (!data.propertyType) {
          if (data.type === 'property' || !data.type) {
            updates.propertyType = determinePropertyType(data.title);
            needsUpdate = true;
          }
        }
        
        // Remove incorrect 'type' field if it's just "property"
        if (data.type === 'property') {
          updates.type = null;
          needsUpdate = true;
        }
        
        // Add priceNumeric field
        if (!data.priceNumeric && data.rate) {
          const numericPrice = parsePrice(data.rate);
          if (numericPrice) {
            updates.priceNumeric = numericPrice;
            needsUpdate = true;
          }
        }
        
        if (needsUpdate) {
          updates.updatedAt = new Date();
          batch.update(db.collection('properties').doc(docSnap.id), updates);
          batchUpdates++;
          totalUpdated++;
        } else {
          totalSkipped++;
        }
      });
      
      if (batchUpdates > 0) {
        console.log(`Committing ${batchUpdates} updates...`);
        await batch.commit();
        console.log(`✅ Batch ${batchCount} committed`);
      }
      
      lastDoc = snapshot.docs[snapshot.docs.length - 1];
      
      // Prevent timeout - break after 25 seconds
      if (batchCount > 20) {
        break;
      }
    }
    
    return NextResponse.json({
      success: true,
      results: {
        totalProcessed,
        totalUpdated,
        totalSkipped,
        batchesProcessed: batchCount
      }
    });
    
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: 'Migration failed', details: error.message },
      { status: 500 }
    );
  }
}