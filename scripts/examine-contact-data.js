const { initializeApp } = require('firebase/app');
const { 
  getFirestore, 
  collection, 
  getDocs, 
  query, 
  limit 
} = require('firebase/firestore');

// Firebase configuration - you'll need to set these environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function examineContactData() {
  const collections = ['properties', 'marketplace', 'services', 'noticeboard', 'housemates'];
  
  console.log('🔍 Examining contact information fields in scraped listings...\n');
  
  for (const collectionName of collections) {
    console.log(`\n📂 Collection: ${collectionName.toUpperCase()}`);
    console.log('=' .repeat(50));
    
    try {
      // Get sample documents from each collection
      const q = query(collection(db, collectionName), limit(5));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        console.log('❌ No documents found in this collection\n');
        continue;
      }
      
      console.log(`📊 Total documents sampled: ${querySnapshot.docs.length}\n`);
      
      // Track contact field statistics
      const contactFieldStats = {};
      const contactFields = [
        'userId', 'userName', 'userEmail', 'phoneNumber', 'phone', 
        'email', 'contactNumber', 'contact', 'agentName', 'agentPhone', 
        'agentEmail', 'seller', 'sellerName', 'sellerPhone', 'sellerEmail',
        'poster', 'posterName', 'posterPhone', 'posterEmail', 'postedBy',
        'owner', 'ownerName', 'ownerPhone', 'ownerEmail'
      ];
      
      // Analyze each document
      querySnapshot.docs.forEach((doc, index) => {
        const data = doc.data();
        
        console.log(`\n🔸 Document ${index + 1} (${doc.id}):`);
        console.log(`   Title: ${data.title || 'N/A'}`);
        
        // Check for contact fields
        const foundFields = {};
        contactFields.forEach(field => {
          if (data.hasOwnProperty(field)) {
            foundFields[field] = data[field];
            // Track statistics
            if (!contactFieldStats[field]) {
              contactFieldStats[field] = { count: 0, values: [] };
            }
            contactFieldStats[field].count++;
            if (data[field] && data[field] !== null && data[field] !== '') {
              contactFieldStats[field].values.push(data[field]);
            }
          }
        });
        
        if (Object.keys(foundFields).length > 0) {
          console.log('   📋 Contact fields found:');
          Object.entries(foundFields).forEach(([field, value]) => {
            const displayValue = value === null ? 'null' : 
                                value === '' ? 'empty string' : 
                                typeof value === 'object' ? JSON.stringify(value) : 
                                String(value);
            console.log(`      ${field}: ${displayValue}`);
          });
        } else {
          console.log('   ❌ No contact fields found');
        }
        
        // Also check for any other fields that might contain contact info
        const otherPossibleFields = Object.keys(data).filter(key => 
          key.toLowerCase().includes('contact') || 
          key.toLowerCase().includes('phone') || 
          key.toLowerCase().includes('email') || 
          key.toLowerCase().includes('user') ||
          key.toLowerCase().includes('agent') ||
          key.toLowerCase().includes('seller') ||
          key.toLowerCase().includes('owner') ||
          key.toLowerCase().includes('poster')
        );
        
        if (otherPossibleFields.length > 0) {
          console.log('   🔍 Other potential contact fields:');
          otherPossibleFields.forEach(field => {
            if (!contactFields.includes(field)) {
              const value = data[field];
              const displayValue = value === null ? 'null' : 
                                  value === '' ? 'empty string' : 
                                  typeof value === 'object' ? JSON.stringify(value) : 
                                  String(value);
              console.log(`      ${field}: ${displayValue}`);
            }
          });
        }
      });
      
      // Summary statistics for this collection
      console.log(`\n📈 Contact Field Statistics for ${collectionName}:`);
      if (Object.keys(contactFieldStats).length > 0) {
        Object.entries(contactFieldStats).forEach(([field, stats]) => {
          const validValues = stats.values.filter(v => v && v !== null && v !== '').length;
          console.log(`   ${field}: Found in ${stats.count}/${querySnapshot.docs.length} docs, ${validValues} with valid values`);
          
          // Show sample values
          if (validValues > 0) {
            const sampleValues = stats.values.filter(v => v && v !== null && v !== '').slice(0, 3);
            console.log(`      Sample values: ${sampleValues.map(v => `"${v}"`).join(', ')}`);
          }
        });
      } else {
        console.log('   ❌ No contact fields found in any documents');
      }
      
    } catch (error) {
      console.error(`❌ Error examining ${collectionName}:`, error.message);
    }
  }
  
  console.log('\n🎯 RECOMMENDATIONS:');
  console.log('1. Check which fields are most commonly populated');
  console.log('2. Look for patterns in contact information storage');
  console.log('3. Identify fallback options when primary contact fields are missing');
  console.log('4. Consider data migration if needed to standardize contact fields');
}

// Run the analysis
examineContactData()
  .then(() => {
    console.log('\n✅ Analysis complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });