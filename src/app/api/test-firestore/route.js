export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';

export async function GET() {
  try {
    console.log('Analyzing Firestore property data structure...');
    const db = getAdminFirestore();
    
    // Get a sample of properties to analyze field structure
    const snapshot = await db.collection('properties')
      .limit(10)
      .get();
    
    const sampleProperties = [];
    const fieldAnalysis = {
      totalSample: snapshot.size,
      hasPropertyType: 0,
      hasType: 0,
      hasPriceNumeric: 0,
      hasRate: 0,
      hasPrice: 0,
      hasListingType: 0,
      typeValues: {},
      propertyTypeValues: {},
      listingTypeValues: {}
    };
    
    snapshot.forEach(doc => {
      const data = doc.data();
      sampleProperties.push({
        id: doc.id,
        title: data.title,
        type: data.type,
        propertyType: data.propertyType,
        listingType: data.listingType,
        rate: data.rate,
        price: data.price,
        priceNumeric: data.priceNumeric,
        hasPropertyType: !!data.propertyType,
        hasType: !!data.type,
        hasPriceNumeric: !!data.priceNumeric,
        hasRate: !!data.rate,
        hasPrice: !!data.price,
        hasListingType: !!data.listingType
      });
      
      // Count field presence
      if (data.propertyType) fieldAnalysis.hasPropertyType++;
      if (data.type) fieldAnalysis.hasType++;
      if (data.priceNumeric) fieldAnalysis.hasPriceNumeric++;
      if (data.rate) fieldAnalysis.hasRate++;
      if (data.price) fieldAnalysis.hasPrice++;
      if (data.listingType) fieldAnalysis.hasListingType++;
      
      // Track unique values
      if (data.type) {
        fieldAnalysis.typeValues[data.type] = (fieldAnalysis.typeValues[data.type] || 0) + 1;
      }
      if (data.propertyType) {
        fieldAnalysis.propertyTypeValues[data.propertyType] = (fieldAnalysis.propertyTypeValues[data.propertyType] || 0) + 1;
      }
      if (data.listingType) {
        fieldAnalysis.listingTypeValues[data.listingType] = (fieldAnalysis.listingTypeValues[data.listingType] || 0) + 1;
      }
    });
    
    // Get total count of properties in collection
    try {
      const totalSnapshot = await db.collection('properties').count().get();
      const totalCount = totalSnapshot.data().count;
      fieldAnalysis.totalPropertiesInCollection = totalCount;
    } catch (countError) {
      console.warn('Count aggregation not available, using alternative method');
      const allSnapshot = await db.collection('properties').select().get();
      fieldAnalysis.totalPropertiesInCollection = allSnapshot.size;
    }
    
    return NextResponse.json({
      success: true,
      sampleProperties,
      fieldAnalysis,
      issues: {
        missingPropertyType: fieldAnalysis.hasPropertyType === 0,
        missingPriceNumeric: fieldAnalysis.hasPriceNumeric === 0,
        usingTypeInsteadOfPropertyType: fieldAnalysis.hasType > 0 && fieldAnalysis.hasPropertyType === 0,
        inconsistentPricing: (fieldAnalysis.hasRate > 0 && fieldAnalysis.hasPriceNumeric === 0)
      },
      recommendations: {
        needsPropertyTypeMigration: fieldAnalysis.hasType > 0 && fieldAnalysis.hasPropertyType === 0,
        needsPriceNumericMigration: fieldAnalysis.hasPriceNumeric === 0,
        needsListingTypeMigration: fieldAnalysis.hasListingType === 0
      }
    });
    
  } catch (error) {
    console.error('Error analyzing Firestore data:', error);
    return NextResponse.json(
      { error: 'Failed to analyze Firestore data', details: error.message },
      { status: 500 }
    );
  }
}