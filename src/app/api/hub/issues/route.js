import { NextResponse } from 'next/server';
import { verifyAuth, isAdmin } from '@/lib/auth-middleware';
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

async function handleGET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const communityId = searchParams.get('communityId');
    const userId = searchParams.get('userId');
    const adminView = searchParams.get('admin') === 'true';

    if (!communityId) {
      return createErrorResponse('Community ID is required', 400);
    }

    // If admin view, get all issues for community
    // If user view, get only user's issues
    const issues = await getIssues(communityId, adminView ? null : userId);
    
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
      
      const issueId = await createIssue(sanitizedData);
      
      return createSuccessResponse({ 
        issueId 
      }, 'Issue created successfully');
    }

    if (action === 'update_status') {
      const { issueId, status, adminNotes } = sanitizedData;
      
      if (!issueId || !status) {
        return createErrorResponse('Issue ID and status are required', 400);
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