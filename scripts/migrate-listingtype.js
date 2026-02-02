// standalone-migrate-listing-types.js
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, getDocs, doc, updateDoc } = require('firebase/firestore');

// Your Firebase Config
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

// Helper function to determine if a property is for sale based on price string
function inferListingType(property) {
  if (!property || !property.price) return 'rent'; // Default
  
  // Convert to string if not already
  const priceString = String(property.price || '');
  
  // Check for keywords that indicate rent
  const rentKeywords = [
    '/month', '/year', 'per month', 'per year', 'per annum', '/annum',
    'monthly', 'annually', 'yearly'
  ];
  
  for (const keyword of rentKeywords) {
    if (priceString.toLowerCase().includes(keyword)) {
      return 'rent';
    }
  }
  
  // Check for sale indicators
  const saleKeywords = ['for sale', 'buy now', 'purchase', 'asking price'];
  for (const keyword of saleKeywords) {
    if (priceString.toLowerCase().includes(keyword)) {
      return 'sale';
    }
  }
  
  // In Nigeria, properties in tens of millions are typically for sale, not rent
  const numericalPrice = parseFloat(priceString.replace(/[^0-9.]/g, ''));
  if (!isNaN(numericalPrice) && numericalPrice > 10000000) {
    return 'sale';
  }
  
  // Default to rent as most properties tend to be rentals
  return 'rent';
}

// Extract rent information from property pricing
function extractRentData(property) {
  if (!property.price) {
    return {
      rentType: 'monthly',
      rentAmount: {
        monthly: '',
        annual: ''
      }
    };
  }

  const priceString = String(property.price);
  const isMonthly = priceString.toLowerCase().includes('/month') || 
                     priceString.toLowerCase().includes('per month') ||
                     priceString.toLowerCase().includes('monthly');
                     
  // Extract the numeric value
  const numericMatch = priceString.match(/[0-9,]+/);
  const numericValue = numericMatch ? numericMatch[0].replace(/,/g, '') : '';
  
  if (isMonthly) {
    return {
      rentType: 'monthly',
      rentAmount: {
        monthly: numericValue,
        annual: ''
      }
    };
  } else {
    return {
      rentType: 'annual',
      rentAmount: {
        monthly: '',
        annual: numericValue
      }
    };
  }
}

// Extract property sale details
function extractSaleDetails(property) {
  return {
    titleDocument: '',
    yearBuilt: '',
    negotiable: property.price && 
               String(property.price).toLowerCase().includes('negotiable')
  };
}

// Test connection to Firestore
async function testConnection() {
  try {
    console.log('Testing connection to Firestore...');
    const testRef = collection(db, 'properties');
    const testSnapshot = await getDocs(testRef);
    console.log(`Connection successful. Found ${testSnapshot.docs.length} documents.`);
    return true;
  } catch (error) {
    console.error('Failed to connect to Firestore:', error);
    return false;
  }
}

// Update property documents with listing type
async function migratePropertyListingTypes() {
  console.log('Starting migration for property listing types...');
  
  try {
    const propertiesRef = collection(db, 'properties');
    const snapshot = await getDocs(propertiesRef);
    
    console.log(`Found ${snapshot.docs.length} properties in total`);
    
    let updated = 0;
    let skipped = 0;
    let saleCount = 0;
    let rentCount = 0;
    let errors = 0;
    
    for (const docSnapshot of snapshot.docs) {
      try {
        const property = docSnapshot.data();
        const propertyId = docSnapshot.id;
        
        // Skip if property already has a listing type
        if (property.listingType) {
          console.log(`Property ${propertyId} already has listing type: ${property.listingType}, skipping.`);
          skipped++;
          continue;
        }
        
        // Infer the listing type
        const listingType = inferListingType(property);
        
        // Prepare update data
        let updateData = { 
          listingType,
          updatedAt: new Date() 
        };
        
        // Add type-specific details
        if (listingType === 'rent') {
          const rentData = extractRentData(property);
          updateData.rentType = rentData.rentType;
          updateData.rentAmount = rentData.rentAmount;
          rentCount++;
        } else {
          updateData.saleDetails = extractSaleDetails(property);
          saleCount++;
        }
        
        console.log(`Updating property ${propertyId} as "${listingType}" type`);
        
        // Update the document
        await updateDoc(doc(db, 'properties', propertyId), updateData);
        
        updated++;
        
        if (updated % 10 === 0) {
          console.log(`Updated ${updated} properties so far`);
        }
      } catch (error) {
        console.error(`Error processing property ${docSnapshot.id}:`, error);
        errors++;
      }
    }
    
    console.log(`
      Property Listing Type Migration completed:
      - Total properties: ${snapshot.docs.length}
      - Updated: ${updated}
      - Skipped: ${skipped}
      - For Rent: ${rentCount}
      - For Sale: ${saleCount}
      - Errors: ${errors}
    `);
  } catch (error) {
    console.error('Error during migration:', error);
  }
}

// Main function
async function runMigration() {
  const connected = await testConnection();
  if (!connected) {
    console.error('Migration aborted due to connection issues.');
    return;
  }
  
  try {
    console.log('Starting property listing type migration...');
    await migratePropertyListingTypes();
    console.log('Migration complete!');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

// Run the migration
runMigration()
  .then(() => {
    console.log('Migration process finished');
    setTimeout(() => process.exit(0), 3000);
  })
  .catch(error => {
    console.error('Migration process failed:', error);
    setTimeout(() => process.exit(1), 3000);
  });