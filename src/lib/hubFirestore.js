// This file is for server-side use only (API routes)
// For client-side usage, use API endpoints instead

import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from './firebase-admin';

// Initialize admin SDK
initAdmin();

// Helper to get Firestore instance
const getDb = () => {
  return getFirestore();
};

// Access Codes
export const createAccessCode = async (codeData) => {
  try {
    const db = getDb();
    const code = generateAccessCode();
    const docRef = await db.collection('hubAccessCodes').add({
      ...codeData,
      code,
      createdAt: new Date(),
      isActive: true,
      usedCount: 0
    });
    return { id: docRef.id, code };
  } catch (error) {
    console.error('Error creating access code:', error);
    throw error;
  }
};

export const getAccessCodes = async (communityId) => {
  try {
    const db = getDb();
    const snapshot = await db.collection('hubAccessCodes')
      .where('communityId', '==', communityId)
      .orderBy('createdAt', 'desc')
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting access codes:', error);
    throw error;
  }
};

export const validateAccessCode = async (code, communityId) => {
  try {
    const db = getDb();
    const snapshot = await db.collection('hubAccessCodes')
      .where('code', '==', code)
      .where('communityId', '==', communityId)
      .where('isActive', '==', true)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return null;
    }
    
    const doc = snapshot.docs[0];
    const data = doc.data();
    
    // Check if code has expired
    if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
      return null;
    }
    
    // Check if code has reached max uses
    if (data.maxUses && data.usedCount >= data.maxUses) {
      return null;
    }
    
    return { id: doc.id, ...data };
  } catch (error) {
    console.error('Error validating access code:', error);
    throw error;
  }
};

// Community Management
export const createDocument = async (collectionName, data) => {
  try {
    const db = getDb();
    const docRef = await db.collection(collectionName).add({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return { id: docRef.id, ...data };
  } catch (error) {
    console.error(`Error creating document in ${collectionName}:`, error);
    throw error;
  }
};

export const getDocument = async (collectionName, docId) => {
  try {
    const db = getDb();
    const doc = await db.collection(collectionName).doc(docId).get();
    
    if (!doc.exists) {
      return null;
    }
    
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error(`Error getting document from ${collectionName}:`, error);
    throw error;
  }
};

export const getDocuments = async (collectionName, filters = {}, sorting = {}, limitCount = null) => {
  try {
    const db = getDb();
    let queryRef = db.collection(collectionName);
    
    // Apply filters
    Object.entries(filters).forEach(([field, value]) => {
      queryRef = queryRef.where(field, '==', value);
    });
    
    // Apply sorting
    if (sorting.field) {
      queryRef = queryRef.orderBy(sorting.field, sorting.direction || 'asc');
    }
    
    // Apply limit
    if (limitCount) {
      queryRef = queryRef.limit(limitCount);
    }
    
    const snapshot = await queryRef.get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      
      // Convert Firestore Timestamps to ISO strings
      Object.keys(data).forEach(key => {
        if (data[key] && typeof data[key].toDate === 'function') {
          data[key] = data[key].toDate().toISOString();
        }
      });
      
      return {
        id: doc.id,
        ...data
      };
    });
  } catch (error) {
    console.error(`Error getting documents from ${collectionName}:`, error);
    throw error;
  }
};

export const updateDocument = async (collectionName, docId, data) => {
  try {
    const db = getDb();
    await db.collection(collectionName).doc(docId).update({
      ...data,
      updatedAt: new Date()
    });
    return { id: docId, ...data };
  } catch (error) {
    console.error(`Error updating document in ${collectionName}:`, error);
    throw error;
  }
};

export const deleteDocument = async (collectionName, docId) => {
  try {
    const db = getDb();
    await db.collection(collectionName).doc(docId).delete();
    return { id: docId };
  } catch (error) {
    console.error(`Error deleting document from ${collectionName}:`, error);
    throw error;
  }
};

// Issues Management
export const createIssue = async (issueData) => {
  return createDocument('hubIssues', {
    ...issueData,
    status: 'open',
    priority: issueData.priority || 'medium'
  });
};

export const getIssues = async (communityId, userId = null, isAdmin = false) => {
  const filters = { communityId };
  
  if (!isAdmin && userId) {
    filters.userId = userId;  // Changed from reportedBy to userId to match the field name used when creating
  }
  
  return getDocuments('hubIssues', filters, { field: 'createdAt', direction: 'desc' });
};

export const updateIssueStatus = async (issueId, status, adminNote = null) => {
  const updateData = { status };
  
  if (adminNote) {
    updateData.adminNote = adminNote;
    updateData.resolvedAt = new Date();
  }
  
  return updateDocument('hubIssues', issueId, updateData);
};


// Emergency Alerts
export const createEmergencyAlert = async (alertData) => {
  return createDocument('hubEmergencyAlerts', {
    ...alertData,
    priority: alertData.priority || 'medium'
  });
};

export const getEmergencyAlerts = async (communityId) => {
  return getDocuments('hubEmergencyAlerts', { communityId }, { field: 'createdAt', direction: 'desc' });
};

// Amenities
export const createAmenityBooking = async (bookingData) => {
  return createDocument('hubAmenityBookings', bookingData);
};

export const getAmenities = async (communityId) => {
  return getDocuments('hubAmenities', { communityId }, { field: 'name', direction: 'asc' });
};


// Marketplace
export const createMarketplaceItem = async (itemData) => {
  return createDocument('hubMarketplace', {
    ...itemData,
    status: 'active'
  });
};

export const getMarketplaceItems = async (communityId) => {
  return getDocuments('hubMarketplace', { communityId, status: 'active' }, { field: 'createdAt', direction: 'desc' });
};

// Notifications
export const createNotification = async (notificationData) => {
  try {
    const db = getDb();
    
    // If userId is 'all', create notification for all community members
    if (notificationData.userId === 'all') {
      // Get all members of the community
      const membersSnapshot = await db.collection('hubMembers')
        .where('communityId', '==', notificationData.communityId)
        .where('status', '==', 'active')
        .get();
      
      if (membersSnapshot.empty) {
        console.warn('No members found for community:', notificationData.communityId);
        return null;
      }
      
      // Create notification for each member
      const batch = db.batch();
      const notificationRefs = [];
      
      membersSnapshot.docs.forEach(memberDoc => {
        const memberData = memberDoc.data();
        const notificationRef = db.collection('hubNotifications').doc();
        notificationRefs.push(notificationRef);
        
        batch.set(notificationRef, {
          ...notificationData,
          userId: memberData.userId,
          isRead: false,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      });
      
      await batch.commit();
      return { created: notificationRefs.length };
    } else {
      // Single user notification
      return createDocument('hubNotifications', {
        ...notificationData,
        isRead: false
      });
    }
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

export const getNotifications = async (communityId, userId = null) => {
  try {
    const filters = { communityId };
    if (userId) {
      filters.userId = userId;
    }
    return await getDocuments('hubNotifications', filters, { field: 'createdAt', direction: 'desc' });
  } catch (error) {
    // Fallback: if composite index is missing, query without orderBy and sort client-side
    if (error.code === 9 || error.message?.includes('FAILED_PRECONDITION') || error.message?.includes('requires an index')) {
      console.warn('Notifications composite index missing, falling back to client-side sort');
      const filters = { communityId };
      if (userId) {
        filters.userId = userId;
      }
      const docs = await getDocuments('hubNotifications', filters);
      return docs.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || a.createdAt?.getTime?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || b.createdAt?.getTime?.() || 0;
        return bTime - aTime;
      });
    }
    throw error;
  }
};

export const markAllNotificationsRead = async (userId, communityId) => {
  try {
    const db = getDb();
    
    // Get all unread notifications for user in community
    const snapshot = await db.collection('hubNotifications')
      .where('userId', '==', userId)
      .where('communityId', '==', communityId)
      .where('isRead', '==', false)
      .get();
    
    if (snapshot.empty) {
      return { updated: 0 };
    }
    
    // Batch update all notifications
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        isRead: true,
        readAt: new Date(),
        updatedAt: new Date()
      });
    });
    
    await batch.commit();
    return { updated: snapshot.size };
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
};

// Visitor Codes
export const createVisitorCode = async (codeData) => {
  const code = generateVisitorCode();
  return createDocument('hubVisitorCodes', {
    ...codeData,
    code,
    status: 'active'
  });
};

export const getVisitorCodes = async (communityId, userId = null, isAdmin = false) => {
  const filters = { communityId };
  if (!isAdmin && userId) {
    filters.createdBy = userId;
  }
  return getDocuments('hubVisitorCodes', filters, { field: 'createdAt', direction: 'desc' });
};

export const validateVisitorCode = async (code, communityId) => {
  const db = getDb();
  const snapshot = await db.collection('hubVisitorCodes')
    .where('code', '==', code)
    .where('communityId', '==', communityId)
    .where('status', '==', 'active')
    .limit(1)
    .get();
  
  if (snapshot.empty) {
    return null;
  }
  
  const doc = snapshot.docs[0];
  const data = doc.data();
  
  // Check if code has expired
  if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
    return null;
  }
  
  return { id: doc.id, ...data };
};

// Helper function to generate access code
function generateAccessCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Community Management
export const createHubCommunity = async (communityData) => {
  try {
    const db = getDb();
    const docRef = await db.collection('hubCommunities').add({
      ...communityData,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active',
      memberCount: 1, // Start with 1 since creator is automatically added
      isPublic: communityData.isPublic || false
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating hub community:', error);
    throw error;
  }
};

export const getHubCommunity = async (communityId) => {
  try {
    const db = getDb();
    const doc = await db.collection('hubCommunities').doc(communityId).get();
    if (!doc.exists) {
      return null;
    }
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error('Error getting hub community:', error);
    throw error;
  }
};

export const searchHubCommunities = async (searchTerm) => {
  try {
    const db = getDb();
    const snapshot = await db.collection('hubCommunities')
      .where('status', '==', 'active')
      .orderBy('name')
      .get();
    
    // Filter by search term (simple contains search)
    const results = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(community => 
        community.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        community.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        community.location?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    
    return results;
  } catch (error) {
    console.error('Error searching hub communities:', error);
    throw error;
  }
};

export const getUserCommunities = async (userId) => {
  try {
    const db = getDb();
    // Get user's memberships
    const memberSnapshot = await db.collection('hubMembers')
      .where('userId', '==', userId)
      .where('status', '==', 'active')
      .get();
    
    console.log(`Found ${memberSnapshot.docs.length} membership records for user ${userId}`);
    
    // Get unique community IDs to prevent duplicates
    const uniqueCommunityIds = [...new Set(memberSnapshot.docs.map(doc => doc.data().communityId))];
    console.log(`Unique community IDs: ${uniqueCommunityIds.length}`, uniqueCommunityIds);
    
    if (uniqueCommunityIds.length === 0) {
      return [];
    }
    
    // Get community details
    const communities = [];
    for (const communityId of uniqueCommunityIds) {
      const community = await getHubCommunity(communityId);
      if (community) {
        // Add user's role from membership (get the latest one if multiple exist)
        const memberDoc = memberSnapshot.docs.find(doc => doc.data().communityId === communityId);
        const memberData = memberDoc?.data();
        
        communities.push({
          ...community,
          role: memberData?.role || 'member',
          joinedAt: memberData?.joinedAt,
          permissions: memberData?.permissions || []
        });
      }
    }
    
    console.log(`Returning ${communities.length} communities for user ${userId}`);
    return communities;
  } catch (error) {
    console.error('Error getting user communities:', error);
    throw error;
  }
};

export const getPublicCommunities = async (limit = 5) => {
  try {
    const db = getDb();
    const snapshot = await db.collection('hubCommunities')
      .where('status', '==', 'active')
      .where('isPublic', '==', true)
      .orderBy('memberCount', 'desc')
      .limit(limit)
      .get();
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting public communities:', error);
    throw error;
  }
};

// Member Management
export const createHubMember = async (memberData) => {
  try {
    const db = getDb();
    const docRef = await db.collection('hubMembers').add({
      ...memberData,
      joinedAt: memberData.joinedAt || new Date(),
      status: memberData.status || 'active'
    });
    
    // Only increment community member count if this is NOT the initial creator
    // (creator count is already included in createHubCommunity)
    if (memberData.communityId && memberData.role !== 'admin') {
      const communityRef = db.collection('hubCommunities').doc(memberData.communityId);
      const communityDoc = await communityRef.get();
      if (communityDoc.exists) {
        const currentCount = communityDoc.data().memberCount || 0;
        await communityRef.update({ memberCount: currentCount + 1 });
      }
    }
    
    return docRef.id;
  } catch (error) {
    console.error('Error creating hub member:', error);
    throw error;
  }
};

export const getHubMember = async (userId, communityId) => {
  try {
    const db = getDb();
    const snapshot = await db.collection('hubMembers')
      .where('userId', '==', userId)
      .where('communityId', '==', communityId)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return null;
    }
    
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error('Error getting hub member:', error);
    throw error;
  }
};

// Helper function to generate visitor code
function generateVisitorCode() {
  const chars = '0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}