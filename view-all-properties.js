// View All Properties - Node.js Script with Firebase Client SDK
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, orderBy } = require('firebase/firestore');

// Firebase Client SDK configuration
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

// Statistics tracking
let stats = {
    total: 0,
    rent: 0,
    sale: 0,
    active: 0,
    undefined: 0,
    inactive: 0,
    apartment: 0,
    house: 0,
    land: 0,
    commercial: 0,
    withImages: 0,
    withoutImages: 0,
    missingStatus: 0,
    missingPropertyType: 0,
    missingPriceNumeric: 0
};

function analyzeProperty(property) {
    stats.total++;
    
    // Listing types
    if (property.listingType === 'rent') stats.rent++;
    else if (property.listingType === 'sale') stats.sale++;
    
    // Status analysis
    if (property.status === 'active') {
        stats.active++;
    } else if (property.status === undefined || property.status === null) {
        stats.undefined++;
        stats.missingStatus++;
    } else if (property.status === 'undefined') {
        stats.undefined++;
    } else {
        stats.inactive++;
    }
    
    // Property types
    if (property.propertyType === 'apartment') stats.apartment++;
    else if (property.propertyType === 'house') stats.house++;
    else if (property.propertyType === 'land') stats.land++;
    else if (property.propertyType === 'commercial') stats.commercial++;
    else stats.missingPropertyType++;
    
    // Images
    if (property.imageUrls && property.imageUrls.length > 0) {
        stats.withImages++;
    } else {
        stats.withoutImages++;
    }
    
    // Price numeric
    if (!property.priceNumeric) {
        stats.missingPriceNumeric++;
    }
}

function displayProperty(property, index) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🏠 PROPERTY ${index + 1}: ${property.title || 'NO TITLE'}`);
    console.log(`${'='.repeat(80)}`);
    
    // Basic info
    console.log(`📍 Location: ${property.location || 'undefined'}`);
    console.log(`💰 Rate: ${property.rate || 'undefined'}`);
    console.log(`🔢 Price Numeric: ${property.priceNumeric || 'undefined'} (${typeof property.priceNumeric})`);
    console.log(`📞 Phone: ${property.phoneNumber || 'undefined'}`);
    
    // Property details
    console.log(`\n🏷️  Property Details:`);
    console.log(`   Listing Type: ${property.listingType || 'undefined'}`);
    console.log(`   Property Type: ${property.propertyType || 'undefined'}`);
    console.log(`   Status: ${property.status || 'undefined'} (${typeof property.status})`);
    
    // Room details
    console.log(`\n🚪 Room Details:`);
    console.log(`   Bedrooms: ${property.bedrooms || 'undefined'} (${typeof property.bedrooms})`);
    console.log(`   Bathrooms: ${property.bathrooms || 'undefined'} (${typeof property.bathrooms})`);
    console.log(`   Toilets: ${property.toilets || 'undefined'} (${typeof property.toilets})`);
    console.log(`   Parking: ${property.parkingSpaces || 'undefined'}`);
    console.log(`   Square Meters: ${property.squareMeters || 'undefined'}`);
    
    // Legacy fields
    console.log(`\n🗂️  Legacy Fields:`);
    console.log(`   Category: ${property.category || 'undefined'} (${typeof property.category})`);
    console.log(`   Type: ${property.type || 'undefined'} (${typeof property.type})`);
    
    // Images
    console.log(`\n🖼️  Images: ${property.imageUrls ? property.imageUrls.length : 0} images`);
    if (property.imageUrls && property.imageUrls.length > 0) {
        console.log(`   First image: ${property.imageUrls[0]}`);
        if (property.imageUrls.length > 1) {
            console.log(`   +${property.imageUrls.length - 1} more images`);
        }
    }
    
    // Timestamps
    console.log(`\n📅 Timestamps:`);
    console.log(`   Created: ${property.createdAt ? new Date(property.createdAt.toDate()).toLocaleString() : 'undefined'}`);
    console.log(`   Updated: ${property.updatedAt ? new Date(property.updatedAt.toDate()).toLocaleString() : 'undefined'}`);
    
    // Document ID
    console.log(`\n🆔 Document ID: ${property.id}`);
    
    // Description preview
    if (property.description) {
        const preview = property.description.replace(/<[^>]*>/g, '').substring(0, 100);
        console.log(`\n📝 Description: ${preview}${property.description.length > 100 ? '...' : ''}`);
    }
}

function displayStats() {
    console.log(`\n${'🟦'.repeat(40)}`);
    console.log(`📊 PROPERTIES STATISTICS`);
    console.log(`${'🟦'.repeat(40)}`);
    
    console.log(`\n📈 Total Properties: ${stats.total}`);
    
    console.log(`\n🏷️  Listing Types:`);
    console.log(`   📍 Rent: ${stats.rent} (${((stats.rent/stats.total)*100).toFixed(1)}%)`);
    console.log(`   💰 Sale: ${stats.sale} (${((stats.sale/stats.total)*100).toFixed(1)}%)`);
    
    console.log(`\n🚦 Status Distribution:`);
    console.log(`   ✅ Active: ${stats.active} (${((stats.active/stats.total)*100).toFixed(1)}%)`);
    console.log(`   ❓ Undefined/Null: ${stats.undefined} (${((stats.undefined/stats.total)*100).toFixed(1)}%)`);
    console.log(`   ❌ Inactive: ${stats.inactive} (${((stats.inactive/stats.total)*100).toFixed(1)}%)`);
    
    console.log(`\n🏠 Property Types:`);
    console.log(`   🏢 Apartment: ${stats.apartment} (${((stats.apartment/stats.total)*100).toFixed(1)}%)`);
    console.log(`   🏘️  House: ${stats.house} (${((stats.house/stats.total)*100).toFixed(1)}%)`);
    console.log(`   🌍 Land: ${stats.land} (${((stats.land/stats.total)*100).toFixed(1)}%)`);
    console.log(`   🏬 Commercial: ${stats.commercial} (${((stats.commercial/stats.total)*100).toFixed(1)}%)`);
    
    console.log(`\n🖼️  Images:`);
    console.log(`   📷 With Images: ${stats.withImages} (${((stats.withImages/stats.total)*100).toFixed(1)}%)`);
    console.log(`   📷 Without Images: ${stats.withoutImages} (${((stats.withoutImages/stats.total)*100).toFixed(1)}%)`);
    
    console.log(`\n⚠️  Data Issues:`);
    console.log(`   🚫 Missing Status: ${stats.missingStatus}`);
    console.log(`   🚫 Missing PropertyType: ${stats.missingPropertyType}`);
    console.log(`   🚫 Missing PriceNumeric: ${stats.missingPriceNumeric}`);
}

async function viewAllProperties(filter = {}) {
    try {
        console.log('🚀 Loading all properties from Firestore...');
        console.log('📊 Project: nijahomzs-1ead3');
        console.log('📦 Collection: properties');
        
        // Get all properties
        const q = query(collection(db, 'properties'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        
        console.log(`\n✅ Found ${snapshot.docs.length} properties`);
        
        const properties = [];
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const property = {
                id: doc.id,
                ...data
            };
            properties.push(property);
            analyzeProperty(property);
        });
        
        // Apply filters if provided
        let filteredProperties = properties;
        
        if (filter.listingType) {
            filteredProperties = filteredProperties.filter(p => p.listingType === filter.listingType);
            console.log(`\n🔍 Filtered by listingType="${filter.listingType}": ${filteredProperties.length} properties`);
        }
        
        if (filter.propertyType) {
            filteredProperties = filteredProperties.filter(p => p.propertyType === filter.propertyType);
            console.log(`\n🔍 Filtered by propertyType="${filter.propertyType}": ${filteredProperties.length} properties`);
        }
        
        if (filter.status !== undefined) {
            if (filter.status === 'undefined') {
                filteredProperties = filteredProperties.filter(p => p.status === undefined || p.status === null || p.status === 'undefined');
            } else {
                filteredProperties = filteredProperties.filter(p => p.status === filter.status);
            }
            console.log(`\n🔍 Filtered by status="${filter.status}": ${filteredProperties.length} properties`);
        }
        
        // Display statistics first
        displayStats();
        
        // Display properties
        console.log(`\n${'🟢'.repeat(40)}`);
        console.log(`📋 DISPLAYING ${filteredProperties.length} PROPERTIES`);
        console.log(`${'🟢'.repeat(40)}`);
        
        filteredProperties.forEach((property, index) => {
            displayProperty(property, index);
        });
        
        console.log(`\n${'🎉'.repeat(40)}`);
        console.log(`✅ COMPLETED! Displayed ${filteredProperties.length} properties`);
        console.log(`${'🎉'.repeat(40)}`);
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error viewing properties:', error);
        process.exit(1);
    }
}

// Parse command line arguments
const args = process.argv.slice(2);
const filter = {};

for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    if (value) {
        filter[key] = value;
    }
}

// Show usage if help requested
if (args.includes('--help') || args.includes('-h')) {
    console.log(`
📋 Properties Viewer - Node.js Script

Usage:
  node view-all-properties.js [options]

Options:
  --listingType <type>    Filter by rent/sale
  --propertyType <type>   Filter by apartment/house/land/commercial  
  --status <status>       Filter by active/undefined/inactive
  --help, -h              Show this help

Examples:
  node view-all-properties.js                           # View all properties
  node view-all-properties.js --listingType rent        # Only rent properties
  node view-all-properties.js --status undefined        # Only properties with undefined status
  node view-all-properties.js --listingType rent --propertyType apartment

Note: Uses Firebase Client SDK with embedded configuration.
No environment variables needed - config is built into the script.
`);
    process.exit(0);
}

console.log('🔍 Starting Properties Viewer...');
if (Object.keys(filter).length > 0) {
    console.log('🔍 Filters applied:', filter);
}

// Run the viewer
viewAllProperties(filter);