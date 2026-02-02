#!/usr/bin/env node

/**
 * Script to create the admin user account for managing scraped listings
 * This creates a special user account to receive all messages from scraped listings
 * 
 * Usage: node scripts/create-admin-user.js
 */

const { initializeApp } = require('firebase/app');
const { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc 
} = require('firebase/firestore');

// Firebase config (you might want to use environment variables)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const ADMIN_USER_ID = 'system-admin-scraped';

async function createAdminUser() {
  try {
    console.log('🚀 Creating admin user for scraped listings...');

    // Check if admin user already exists
    const adminUserRef = doc(db, 'users', ADMIN_USER_ID);
    const adminUserSnap = await getDoc(adminUserRef);

    if (adminUserSnap.exists()) {
      console.log('✅ Admin user already exists');
      console.log('   User ID:', ADMIN_USER_ID);
      console.log('   Data:', adminUserSnap.data());
      return;
    }

    // Create the admin user document
    const adminUserData = {
      displayName: 'Scraped Listings Admin',
      email: 'admin+scraped@nijahomzs.com',
      role: 'admin',
      type: 'system',
      purpose: 'manage_scraped_listings',
      createdAt: new Date(),
      isActive: true,
      description: 'System user for managing customer inquiries on scraped listings',
      permissions: [
        'read_all_scraped_messages',
        'forward_scraped_messages',
        'manage_scraped_listings'
      ]
    };

    await setDoc(adminUserRef, adminUserData);

    console.log('✅ Admin user created successfully!');
    console.log('   User ID:', ADMIN_USER_ID);
    console.log('   Email:', adminUserData.email);
    console.log('   Role:', adminUserData.role);
    console.log('');
    console.log('📋 Next Steps:');
    console.log('   1. Run the migration script to assign scraped listings to this user');
    console.log('   2. Access admin messages at: /dashboard?tab=admin-messages');
    console.log('   3. Configure your admin account to access this dashboard');
    console.log('');
    console.log('💡 The admin dashboard will show all customer inquiries for scraped listings');
    console.log('   and help you forward them to the original sellers.');

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
}

// Help text
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
📋 Admin User Creation Script

Usage: node scripts/create-admin-user.js

This script creates a special system user account that will receive all
customer messages for scraped listings. This allows you to:

✅ Maintain normal user experience for customers
✅ Centrally manage all scraped listing inquiries
✅ Forward customer messages to original sellers
✅ Track message status and response rates

The admin user ID will be: ${ADMIN_USER_ID}

After running this script, you can:
1. Access admin messages in the dashboard
2. Run the migration script to link existing scraped listings
3. Start managing customer inquiries efficiently
  `);
  process.exit(0);
}

// Run the creation
createAdminUser().then(() => {
  console.log('🎉 Admin user setup complete!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Failed to create admin user:', error);
  process.exit(1);
});