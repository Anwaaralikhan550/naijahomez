#!/usr/bin/env node
/* eslint-disable no-console */
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');
const admin = require('firebase-admin');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const HUB_NAME = 'NaijaHomz Beta Launch';
const execute = process.argv.includes('--execute');

const TEST_PATTERN = /\b(test|dummy|fake|qa|demo|sample|staging|temp|sandbox|trial|dev)\b/i;
const SERVICE_TYPES = ['generator', 'water', 'security', 'internet'];

const COMMUNITY_SCOPED_COLLECTIONS = [
  'hubMembers',
  'hubAccessCodes',
  'joinRequests',
  'socialPosts',
  'communityEvents',
  'eventRsvps',
  'hubEmergencyAlerts',
  'hubNotifications',
  'hubIssues',
  'hubMarketplace',
  'marketplace',
  'hubSmartServices',
  'hubAmenities',
  'hubAmenityBookings',
  'visitorCodes',
  'hubVisitorCodes',
  'notifications',
  'chatMessages',
  'forumDiscussions',
  'forumReplies'
];

const USER_SCOPED_COLLECTIONS = [
  { name: 'users', field: '__name__' }, // special handling
  { name: 'hubMembers', field: 'userId' },
  { name: 'joinRequests', field: 'userId' },
  { name: 'privateMessages', field: 'senderId' },
  { name: 'socialPosts', field: 'authorId' },
  { name: 'socialComments', field: 'authorId' },
  { name: 'notifications', field: 'userId' },
  { name: 'eventRsvps', field: 'userId' },
  { name: 'communityEvents', field: 'organizerId' },
  { name: 'marketplace', field: 'userId' }
];

function initAdmin() {
  if (admin.apps.length) return;

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountKey) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(serviceAccountKey)) });
    return;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase admin env vars.');
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n')
    }),
    projectId
  });
}

function isLikelyTest(value) {
  if (!value) return false;
  return TEST_PATTERN.test(String(value).toLowerCase());
}

function summarizeDocText(data = {}) {
  return [
    data.name,
    data.title,
    data.description,
    data.location,
    data.userName,
    data.email,
    data.userEmail,
    data.displayName
  ]
    .filter(Boolean)
    .join(' ');
}

function generateCode(prefix = 'NB') {
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}${random}`.slice(0, 8);
}

async function getAllDocs(collectionRef) {
  const snapshot = await collectionRef.get();
  return snapshot.docs;
}

async function deleteDocs(docs, reason, counters) {
  if (!docs.length) return;
  counters.toDelete += docs.length;
  if (!execute) return;

  const db = admin.firestore();
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch();
    docs.slice(i, i + 400).forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
  counters.deleted += docs.length;
  console.log(`Deleted ${docs.length} docs for ${reason}`);
}

async function main() {
  initAdmin();
  const db = admin.firestore();
  const auth = admin.auth();

  const counters = {
    toDelete: 0,
    deleted: 0,
    deletedAuthUsers: 0,
    createdCodes: 0
  };

  console.log(`Mode: ${execute ? 'EXECUTE' : 'DRY-RUN'}`);

  const communities = await getAllDocs(db.collection('hubCommunities'));
  const testCommunityDocs = communities.filter((doc) => {
    const data = doc.data() || {};
    if ((data.name || '').trim() === HUB_NAME) return false;
    return isLikelyTest(summarizeDocText(data));
  });
  const testCommunityIds = new Set(testCommunityDocs.map((doc) => doc.id));
  console.log(`Detected test/dummy communities: ${testCommunityDocs.length}`);

  // Delete community-scoped records
  for (const collectionName of COMMUNITY_SCOPED_COLLECTIONS) {
    const snapshot = await getAllDocs(db.collection(collectionName));
    const matching = snapshot.filter((doc) => testCommunityIds.has((doc.data() || {}).communityId));
    await deleteDocs(matching, `${collectionName} by test communities`, counters);
  }

  // Delete test communities themselves
  await deleteDocs(testCommunityDocs, 'hubCommunities test/dummy', counters);

  // Delete dummy marketplace items globally
  const marketplaceDocs = await getAllDocs(db.collection('marketplace'));
  const dummyMarketplaceDocs = marketplaceDocs.filter((doc) => {
    const data = doc.data() || {};
    if (testCommunityIds.has(data.communityId)) return true;
    return isLikelyTest(summarizeDocText(data));
  });
  await deleteDocs(dummyMarketplaceDocs, 'marketplace test/dummy items', counters);

  // Find fake users (Firestore + Auth)
  const userDocs = await getAllDocs(db.collection('users'));
  const fakeUserDocs = userDocs.filter((doc) => {
    const data = doc.data() || {};
    return isLikelyTest(summarizeDocText(data));
  });
  const fakeUserIds = new Set(fakeUserDocs.map((doc) => doc.id));
  console.log(`Detected fake user docs: ${fakeUserDocs.length}`);

  for (const target of USER_SCOPED_COLLECTIONS) {
    if (target.field === '__name__') {
      await deleteDocs(fakeUserDocs, 'users fake accounts', counters);
      continue;
    }
    const snapshot = await getAllDocs(db.collection(target.name));
    const matching = snapshot.filter((doc) => fakeUserIds.has((doc.data() || {})[target.field]));
    await deleteDocs(matching, `${target.name} fake-user references`, counters);
  }

  // Private conversations (array-contains participantIds)
  const convDocs = await getAllDocs(db.collection('privateConversations'));
  const fakeConversations = convDocs.filter((doc) => {
    const participantIds = (doc.data() || {}).participantIds || [];
    return Array.isArray(participantIds) && participantIds.some((uid) => fakeUserIds.has(uid));
  });
  await deleteDocs(fakeConversations, 'privateConversations fake participants', counters);

  // Delete Firebase Auth fake users
  if (execute && fakeUserIds.size > 0) {
    for (const uid of fakeUserIds) {
      try {
        await auth.deleteUser(uid);
        counters.deletedAuthUsers += 1;
      } catch (error) {
        if (error.code !== 'auth/user-not-found') {
          console.warn(`Auth delete skipped for ${uid}: ${error.message}`);
        }
      }
    }
  }

  // Ensure beta launch community exists
  const betaSnapshot = await db.collection('hubCommunities').where('name', '==', HUB_NAME).limit(1).get();
  let betaCommunityId;
  if (!betaSnapshot.empty) {
    betaCommunityId = betaSnapshot.docs[0].id;
    if (execute) {
      await betaSnapshot.docs[0].ref.update({
        status: 'active',
        isPublic: true,
        updatedAt: new Date()
      });
    }
  } else {
    // Select an admin owner (env override first, then first non-test user)
    let adminUid = process.env.BETA_LAUNCH_ADMIN_UID || '';
    if (!adminUid) {
      const realUser = userDocs.find((doc) => !fakeUserIds.has(doc.id));
      adminUid = realUser?.id || 'system-beta-launch';
    }

    if (execute) {
      const ref = await db.collection('hubCommunities').add({
        name: HUB_NAME,
        description: 'Official beta testing hub for NaijaHomz. Stable environment for 4-week live user testing.',
        location: 'Nigeria',
        createdBy: adminUid,
        adminIds: [adminUid],
        status: 'active',
        isPublic: true,
        memberCount: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      betaCommunityId = ref.id;

      await db.collection('hubMembers').add({
        userId: adminUid,
        communityId: betaCommunityId,
        role: 'admin',
        status: 'active',
        isActive: true,
        permissions: ['read', 'write', 'moderate', 'admin'],
        joinedAt: new Date()
      });
    } else {
      betaCommunityId = '<will-create-on-execute>';
    }
  }

  // Seed invitation access codes for 5-10 testers
  if (execute && betaCommunityId && betaCommunityId !== '<will-create-on-execute>') {
    const existingCodes = await db.collection('hubAccessCodes')
      .where('communityId', '==', betaCommunityId)
      .where('isActive', '==', true)
      .get();

    const toCreate = Math.max(0, 10 - existingCodes.size);
    for (let i = 0; i < toCreate; i += 1) {
      await db.collection('hubAccessCodes').add({
        communityId: betaCommunityId,
        code: generateCode('NB'),
        description: 'NaijaHomz Beta Tester Access',
        maxUses: 1,
        role: 'member',
        isActive: true,
        usedCount: 0,
        createdBy: 'beta-launch-script',
        createdByName: 'Beta Launch Script',
        createdAt: new Date(),
        lastModifiedAt: new Date()
      });
      counters.createdCodes += 1;
    }
  }

  // Ensure Smart Services baseline records exist for beta hub
  if (execute && betaCommunityId && betaCommunityId !== '<will-create-on-execute>') {
    for (const serviceType of SERVICE_TYPES) {
      const existing = await db.collection('hubSmartServices')
        .where('communityId', '==', betaCommunityId)
        .where('type', '==', serviceType)
        .limit(1)
        .get();
      if (existing.empty) {
        await db.collection('hubSmartServices').add({
          communityId: betaCommunityId,
          type: serviceType,
          title: `${serviceType[0].toUpperCase()}${serviceType.slice(1)} Status`,
          status: 'active',
          currentStatus: 'operational',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }
  }

  // Audit snapshot
  let audit = {};
  if (execute && betaCommunityId && betaCommunityId !== '<will-create-on-execute>') {
    const [memberSnap, codeSnap, smartServiceSnap, marketSnap] = await Promise.all([
      db.collection('hubMembers').where('communityId', '==', betaCommunityId).where('isActive', '==', true).get(),
      db.collection('hubAccessCodes').where('communityId', '==', betaCommunityId).where('isActive', '==', true).get(),
      db.collection('hubSmartServices').where('communityId', '==', betaCommunityId).get(),
      db.collection('marketplace').where('communityId', '==', betaCommunityId).get()
    ]);
    audit = {
      betaCommunityId,
      activeMembers: memberSnap.size,
      activeInviteCodes: codeSnap.size,
      smartServiceRecords: smartServiceSnap.size,
      betaMarketplaceItems: marketSnap.size
    };
  }

  console.log('--- SUMMARY ---');
  console.log(JSON.stringify({
    mode: execute ? 'execute' : 'dry-run',
    betaHubName: HUB_NAME,
    deletedDocsPlanned: counters.toDelete,
    deletedDocsExecuted: counters.deleted,
    deletedAuthUsers: counters.deletedAuthUsers,
    createdInviteCodes: counters.createdCodes,
    audit
  }, null, 2));
}

main().catch((error) => {
  console.error('prepare-beta-launch failed:', error);
  process.exit(1);
});

