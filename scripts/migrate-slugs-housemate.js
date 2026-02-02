// housemate-migrate-slugs.js
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
    const testRef = collection(db, 'housemate');
    const testSnapshot = await getDocs(testRef);
    console.log(`Connection successful. Found ${testSnapshot.docs.length} documents in housemate collection.`);
    return true;
  } catch (error) {
    console.error('Failed to connect to Firestore:', error);
    return false;
  }
}

// Update housemate collection slugs
async function migrateHousemateCollection() {
  console.log(`Starting migration for housemate collection`);
  
  try {
    const collectionRef = collection(db, 'housemate');
    const snapshot = await getDocs(collectionRef);
    
    console.log(`Found ${snapshot.docs.length} documents in housemate collection`);
    
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    
    // Create a Map to track duplicates
    const slugMap = new Map();
    
    // First pass - identify all documents and generate potential slugs
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
        
        const uniqueSlug = generateDocumentSlug(docData.title, docId);
        slugMap.set(docId, uniqueSlug);
        
      } catch (error) {
        console.error(`Error processing document in first pass:`, error);
        errors++;
      }
    }
    
    // Second pass - update documents with new slugs
    for (const docSnapshot of snapshot.docs) {
      try {
        const docData = docSnapshot.data();
        const docId = docSnapshot.id;
        
        // Skip if document has no title
        if (!docData.title) {
          continue;
        }
        
        // Skip if it already has a unique slug that includes a portion of the doc ID
        if (docData.slug && docData.slug.includes(docId.substring(0, 8))) {
          console.log(`Document ${docId} already has a unique slug: ${docData.slug}, skipping.`);
          skipped++;
          continue;
        }
        
        // Get the unique slug from our map
        const uniqueSlug = slugMap.get(docId);
        console.log(`Updating document ${docId} with new slug: ${uniqueSlug}`);
        
        // Update the document
        await updateDoc(doc(db, 'housemate', docId), { 
          slug: uniqueSlug,
          updatedAt: new Date() 
        });
        
        updated++;
        
        if (updated % 10 === 0) {
          console.log(`Updated ${updated} documents in housemate collection`);
        }
      } catch (error) {
        console.error(`Error processing document:`, error);
        errors++;
      }
    }
    
    console.log(`
      Migration completed for housemate collection:
      - Total documents: ${snapshot.docs.length}
      - Updated: ${updated}
      - Skipped: ${skipped}
      - Errors: ${errors}
    `);
  } catch (error) {
    console.error(`Error processing housemate collection:`, error);
  }
}

// Main function
async function migrateHousemates() {
  const connected = await testConnection();
  if (!connected) {
    console.error('Migration aborted due to connection issues.');
    return;
  }
  
  try {
    console.log('Starting migration for housemate collection...');
    
    // Process housemate collection
    await migrateHousemateCollection();
    
    console.log('Migration complete!');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

// Run the migration
migrateHousemates()
  .then(() => {
    console.log('Migration process finished');
    setTimeout(() => process.exit(0), 3000);
  })
  .catch(error => {
    console.error('Migration process failed:', error);
    setTimeout(() => process.exit(1), 3000);
  });