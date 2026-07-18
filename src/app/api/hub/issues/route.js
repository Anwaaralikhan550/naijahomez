export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyAuth, isAdmin } from '@/lib/auth-middleware';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { 
  createIssue,
  getIssues,
  updateDocument 
} from '@/lib/hubFirestore';
import { 
  createErrorResponse, 
  createSuccessResponse,
  sanitizeInput 
} from '@/lib/api-validation-middleware';

async function isCommunityAdmin(userId, communityId) {
  if (!userId || !communityId) return false;

  const db = getAdminFirestore();
  const membersSnapshot = await db.collection('hubMembers')
    .where('userId', '==', userId)
    .where('communityId', '==', communityId)
    .where('role', '==', 'admin')
    .limit(5)
    .get();

  if (membersSnapshot.empty) return false;

  return membersSnapshot.docs.some((doc) => {
    const data = doc.data() || {};
    return data.isActive === true || data.status === 'active' || (data.isActive == null && data.status == null);
  });
}

async function canManageCommunityIssues(request, userId, communityId) {
  const globalAdminResult = await isAdmin(request);
  if (globalAdminResult.success) {
    return true;
  }

  return isCommunityAdmin(userId, communityId);
}

async function handleGET(request) {
  try {
    // SECURITY: Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const { searchParams } = new URL(request.url);
    const communityId = searchParams.get('communityId');

    if (!communityId) {
      return createErrorResponse('Community ID is required', 400);
    }

    const canManageIssues = await canManageCommunityIssues(request, authResult.userId, communityId);
    const issues = await getIssues(communityId, authResult.userId, canManageIssues);
    
    return createSuccessResponse({ issues });
  } catch (error) {
    console.error('Error in issues API:', error);
    return createErrorResponse(error.message, 500);
  }
}

async function handlePOST(request) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const userId = authResult.userId;
    
    // Parse the request body manually
    let body;
    try {
      body = await request.json();
    } catch (error) {
      console.error('Failed to parse request body:', error);
      return createErrorResponse('Invalid JSON in request body', 400);
    }
    
    const { action, ...data } = body;

    // Debug logging
    console.log('Issues API - Raw body:', body);
    console.log('Issues API - Action:', action);
    console.log('Issues API - Data before sanitization:', data);

    // Sanitize input data
    const sanitizedData = sanitizeInput(data);
    
    console.log('Issues API - Data after sanitization:', sanitizedData);
    console.log('Issues API - Required fields check:', {
      communityId: sanitizedData.communityId,
      title: sanitizedData.title,
      description: sanitizedData.description
    });

    if (action === 'create_issue') {
      if (!sanitizedData.communityId || !sanitizedData.title || !sanitizedData.description) {
        console.log('Issues API - Validation failed. Missing required fields.');
        return createErrorResponse('Community ID, title, and description are required', 400);
      }

      const issuePayload = {
        ...sanitizedData,
        userId,
        reportedBy: userId
      };
      
      const issueId = await createIssue(issuePayload);
      
      return createSuccessResponse({ 
        issueId 
      }, 'Issue created successfully');
    }

    if (action === 'update_status') {
      const { issueId, status, adminNotes } = sanitizedData;
      
      if (!issueId || !status) {
        return createErrorResponse('Issue ID and status are required', 400);
      }

      const db = getAdminFirestore();
      const issueRef = db.collection('hubIssues').doc(issueId);
      const issueSnapshot = await issueRef.get();
      if (!issueSnapshot.exists) {
        return createErrorResponse('Issue not found', 404);
      }

      const issueData = issueSnapshot.data() || {};
      const canManage = await canManageCommunityIssues(request, userId, issueData.communityId);
      if (!canManage) {
        return createErrorResponse('Admin access required to update issue status', 403);
      }
      
      await updateDocument('hubIssues', issueId, { 
        status, 
        adminNotes,
        updatedAt: new Date() 
      });
      return createSuccessResponse({}, 'Issue status updated successfully');
    }

    return createErrorResponse('Invalid action', 400);
  } catch (error) {
    console.error('Error in issues POST:', error);
    return createErrorResponse(error.message, 500);
  }
}

// Export handlers directly (remove problematic middleware)
export const GET = handleGET;
export const POST = handlePOST;
