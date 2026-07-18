// standalone-migrate-slugs.js
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, getDocs, doc, updateDoc } = require('firebase/firestore');

// Your Firebase Config
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

// Slugify function
function slugify(text) {
  if (!text) return '';
  
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text
}

// Generate a unique slug using document ID
function generateDocumentSlug(title, docId) {
  if (!title || !docId) return '';
  
  // Take the first 8 characters of the ID for brevity
  const shortId = docId.substring(0, 8);
  return `${slugify(title)}-${shortId}`;
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

// Update documents one by one
async function migrateCollection(collectionName) {
  console.log(`Starting migration for collection: ${collectionName}`);
  
  try {
    const collectionRef = collection(db, collectionName);
    const snapshot = await getDocs(collectionRef);
    
    console.log(`Found ${snapshot.docs.length} documents in ${collectionName}`);
    
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const docSnapshot of snapshot.docs) {
      try {
        const docData = docSnapshot.data();
        const docId = docSnapshot.id;
        
        // Skip if document has no title
        if (!docData.title) {
          console.log(`Document ${docId} has no title, skipping.`);
          skipped++;
          continue;
        }
        
        // Skip if it already has a unique slug that includes a portion of the doc ID
        if (docData.slug && docData.slug.includes(docId.substring(0, 8))) {
          skipped++;
          continue;
        }
        
        // Generate unique slug
        const uniqueSlug = generateDocumentSlug(docData.title, docId);
        console.log(`Updating document ${docId} with new slug: ${uniqueSlug}`);
        
        // Update the document
        await updateDoc(doc(db, collectionName, docId), { 
          slug: uniqueSlug,
          updatedAt: new Date() 
        });
        
        updated++;
        
        if (updated % 10 === 0) {
          console.log(`Updated ${updated} documents in ${collectionName}`);
        }
      } catch (error) {
        console.error(`Error processing document:`, error);
        errors++;
      }
    }
    
    console.log(`
      Migration completed for ${collectionName}:
      - Total documents: ${snapshot.docs.length}
      - Updated: ${updated}
      - Skipped: ${skipped}
      - Errors: ${errors}
    `);
  } catch (error) {
    console.error(`Error processing collection ${collectionName}:`, error);
  }
}

// Main function
async function migrateAllCollections() {
  const connected = await testConnection();
  if (!connected) {
    console.error('Migration aborted due to connection issues.');
    return;
  }
  
  try {
    console.log('Starting migration for all collections...');
    
    // Process collections one by one
    await migrateCollection('properties');
    await migrateCollection('marketplace');
    await migrateCollection('services');
    
    console.log('Migration complete!');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

// Run the migration
migrateAllCollections()
  .then(() => {
    console.log('Migration process finished');
    setTimeout(() => process.exit(0), 3000);
  })
  .catch(error => {
    console.error('Migration process failed:', error);
    setTimeout(() => process.exit(1), 3000);
  });
