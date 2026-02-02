#!/usr/bin/env node
/**
 * Migration script to update existing users to work with new email verification system
 * 
 * This script:
 * 1. Finds all users created before the email verification cutoff date
 * 2. Marks them as not requiring email verification (legacy users)
 * 3. Identifies Google sign-in users and marks them appropriately
 * 
 * Run with: node scripts/migrate-existing-users.js
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, updateDoc, doc } = require('firebase/firestore');

// Firebase config - you'll need to add your config here
const firebaseConfig = {
  // Add your Firebase configuration here
  // This should match your production configuration
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const VERIFICATION_CUTOFF_DATE = new Date('2025-01-01');

async function migrateExistingUsers() {
  console.log('🚀 Starting user migration for email verification...');
  console.log(`📅 Cutoff date: ${VERIFICATION_CUTOFF_DATE.toISOString()}`);
  
  try {
    // Get all users from Firestore
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const totalUsers = usersSnapshot.size;
    
    console.log(`👥 Found ${totalUsers} users to process`);
    
    let processedCount = 0;
    let updatedCount = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      
      processedCount++;
      console.log(`\n[${processedCount}/${totalUsers}] Processing user: ${userId}`);
      
      const updates = {};
      let needsUpdate = false;
      
      // Check creation date
      const createdAt = userData.createdAt?.toDate?.() || new Date(userData.createdAt) || null;
      const isLegacyUser = !createdAt || createdAt < VERIFICATION_CUTOFF_DATE;
      
      // Determine sign-in provider
      const signInProvider = userData.signInProvider || 'email';
      const isGoogleUser = signInProvider === 'google.com';
      
      console.log(`  📧 Email: ${userData.email}`);
      console.log(`  📅 Created: ${createdAt ? createdAt.toISOString() : 'Unknown'}`);
      console.log(`  🏷️  Provider: ${signInProvider}`);
      console.log(`  👴 Legacy user: ${isLegacyUser}`);
      console.log(`  🌐 Google user: ${isGoogleUser}`);
      
      // Update signInProvider if not set
      if (!userData.signInProvider) {
        updates.signInProvider = 'email'; // Default for existing users
        needsUpdate = true;
        console.log('  ✏️  Setting signInProvider to: email');
      }
      
      // Set emailVerified for Google users
      if (isGoogleUser && !userData.emailVerified) {
        updates.emailVerified = true;
        needsUpdate = true;
        console.log('  ✅ Setting emailVerified to: true (Google user)');
      }
      
      // Mark legacy users as not requiring verification
      if (isLegacyUser && userData.requiresEmailVerification !== false) {
        updates.requiresEmailVerification = false;
        needsUpdate = true;
        console.log('  🏷️  Setting requiresEmailVerification to: false (legacy user)');
      }
      
      // Update user document if needed
      if (needsUpdate) {
        try {
          await updateDoc(doc(db, 'users', userId), {
            ...updates,
            updatedAt: new Date()
          });
          updatedCount++;
          console.log('  ✅ User updated successfully');
        } catch (error) {
          console.error(`  ❌ Error updating user ${userId}:`, error.message);
        }
      } else {
        console.log('  ⏭️  No updates needed');
      }
    }
    
    console.log('\n🎉 Migration completed!');
    console.log(`📊 Summary:`);
    console.log(`  - Total users processed: ${processedCount}`);
    console.log(`  - Users updated: ${updatedCount}`);
    console.log(`  - Users unchanged: ${processedCount - updatedCount}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  migrateExistingUsers()
    .then(() => {
      console.log('✅ Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateExistingUsers };