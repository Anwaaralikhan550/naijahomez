#!/usr/bin/env node
/**
 * Script to add sample coordinates to existing properties
 * For demonstration purposes - in production, use a geocoding service
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, updateDoc, doc } = require('firebase/firestore');

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCeUNqySxbTnTtzyh8fUeWfzVAgckmrUIU",
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

async function addCoordinatesToProperties() {
  console.log('🚀 Starting to add coordinates to properties...');
  
  try {
    // Get all properties
    const propertiesSnapshot = await getDocs(collection(db, 'properties'));
    const totalProperties = propertiesSnapshot.size;
    
    console.log(`📍 Found ${totalProperties} properties to process`);
    
    let processedCount = 0;
    let updatedCount = 0;
    
    for (const propertyDoc of propertiesSnapshot.docs) {
      const propertyData = propertyDoc.data();
      const propertyId = propertyDoc.id;
      
      processedCount++;
      console.log(`\n[${processedCount}/${totalProperties}] Processing property: ${propertyId}`);
      console.log(`  📍 Location: ${propertyData.location}`);
      
      // Skip if already has coordinates
      if (propertyData.coordinates && propertyData.coordinates.latitude && propertyData.coordinates.longitude) {
        console.log('  ✅ Already has coordinates, skipping');
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
        updatedCount++;
        console.log(`  ✅ Added coordinates: ${coordinates.latitude}, ${coordinates.longitude}`);
      } catch (error) {
        console.error(`  ❌ Error updating property ${propertyId}:`, error.message);
      }
    }
    
    console.log('\n🎉 Coordinate addition completed!');
    console.log(`📊 Summary:`);
    console.log(`  - Total properties processed: ${processedCount}`);
    console.log(`  - Properties updated: ${updatedCount}`);
    console.log(`  - Properties skipped: ${processedCount - updatedCount}`);
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  addCoordinatesToProperties()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { addCoordinatesToProperties };