#!/usr/bin/env node
/**
 * Batch script to add sample coordinates to existing properties
 * Processes properties in batches to handle large datasets
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, updateDoc, doc, query, where, limit, startAfter } = require('firebase/firestore');

// Your Firebase config
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || "your_api_key_here",
  authDomain: "nijahomzs-1ead3.firebaseapp.com",
  projectId: "nijahomzs-1ead3",
  storageBucket: "nijahomzs-1ead3.firebasestorage.app",
  messagingSenderId: "495544413710",
  appId: "1:495544413710:web:32c35206f5dfef2cedd65f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Sample coordinates for different Lagos areas
const lagosAreaCoordinates = {
  'lekki': { latitude: 6.4698, longitude: 3.5852 },
  'ikeja': { latitude: 6.6018, longitude: 3.3515 },
  'victoria island': { latitude: 6.4281, longitude: 3.4219 },
  'ikoyi': { latitude: 6.4549, longitude: 3.4246 },
  'yaba': { latitude: 6.5095, longitude: 3.3711 },
  'surulere': { latitude: 6.4926, longitude: 3.3490 },
  'ajah': { latitude: 6.4691, longitude: 3.5618 },
  'festac': { latitude: 6.4667, longitude: 3.2833 },
  'oshodi': { latitude: 6.5514, longitude: 3.3389 },
  'mushin': { latitude: 6.5274, longitude: 3.3543 },
  'gbagada': { latitude: 6.5500, longitude: 3.3833 },
  'isolo': { latitude: 6.5333, longitude: 3.3333 },
  'default': { latitude: 6.5244, longitude: 3.3792 } // Lagos center
};

// Generate random offset for variety
function addRandomOffset(coord, maxOffset = 0.01) {
  return coord + (Math.random() - 0.5) * maxOffset;
}

// Get coordinates based on location string
function getCoordinatesForLocation(locationString) {
  const location = locationString.toLowerCase();
  
  // Check if location contains any known area
  for (const [area, coords] of Object.entries(lagosAreaCoordinates)) {
    if (location.includes(area)) {
      return {
        latitude: addRandomOffset(coords.latitude),
        longitude: addRandomOffset(coords.longitude)
      };
    }
  }
  
  // Return default Lagos coordinates with random offset
  return {
    latitude: addRandomOffset(lagosAreaCoordinates.default.latitude, 0.05),
    longitude: addRandomOffset(lagosAreaCoordinates.default.longitude, 0.05)
  };
}

async function batchAddCoordinates() {
  console.log('ðŸš€ Starting batch coordinate addition...');
  
  try {
    const BATCH_SIZE = 50;
    let totalProcessed = 0;
    let totalUpdated = 0;
    let lastDoc = null;
    
    while (true) {
      console.log(`\nðŸ“¦ Processing batch starting from document ${totalProcessed + 1}...`);
      
      // Build query with pagination
      let q = query(
        collection(db, 'properties'),
        limit(BATCH_SIZE)
      );
      
      if (lastDoc) {
        q = query(
          collection(db, 'properties'),
          startAfter(lastDoc),
          limit(BATCH_SIZE)
        );
      }
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        console.log('âœ… No more documents to process');
        break;
      }
      
      console.log(`ðŸ“ Found ${snapshot.size} properties in this batch`);
      
      let batchProcessed = 0;
      let batchUpdated = 0;
      
      for (const propertyDoc of snapshot.docs) {
        const propertyData = propertyDoc.data();
        const propertyId = propertyDoc.id;
        
        batchProcessed++;
        totalProcessed++;
        
        // Skip if already has coordinates
        if (propertyData.coordinates && propertyData.coordinates.latitude && propertyData.coordinates.longitude) {
          continue;
        }
        
        // Generate coordinates based on location
        const coordinates = getCoordinatesForLocation(propertyData.location || '');
        
        // Update property with coordinates
        try {
          await updateDoc(doc(db, 'properties', propertyId), {
            coordinates: coordinates,
            updatedAt: new Date()
          });
          batchUpdated++;
          totalUpdated++;
          
          if (batchUpdated % 10 === 0) {
            console.log(`  âœ… Updated ${batchUpdated} properties in this batch...`);
          }
        } catch (error) {
          console.error(`  âŒ Error updating property ${propertyId}:`, error.message);
        }
      }
      
      console.log(`ðŸ“Š Batch complete: ${batchUpdated} updated out of ${batchProcessed} processed`);
      console.log(`ðŸ“ˆ Total progress: ${totalUpdated} updated out of ${totalProcessed} processed`);
      
      // Set last document for pagination
      lastDoc = snapshot.docs[snapshot.docs.length - 1];
      
      // Add a small delay to avoid overwhelming Firestore
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\nðŸŽ‰ Batch coordinate addition completed!');
    console.log(`ðŸ“Š Final Summary:`);
    console.log(`  - Total properties processed: ${totalProcessed}`);
    console.log(`  - Properties updated: ${totalUpdated}`);
    console.log(`  - Properties skipped: ${totalProcessed - totalUpdated}`);
    
  } catch (error) {
    console.error('âŒ Script failed:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  batchAddCoordinates()
    .then(() => {
      console.log('âœ… Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('âŒ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { batchAddCoordinates };
