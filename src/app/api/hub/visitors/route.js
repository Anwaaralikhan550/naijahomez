export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyAuth, isAdmin } from '@/lib/auth-middleware';
import { 
  createVisitorCode,
  getVisitorCodes,
  validateVisitorCode,
  updateDocument 
} from '@/lib/hubFirestore';
import { 
  withApiSecurity, 
  createErrorResponse, 
  createSuccessResponse,
  sanitizeInput 
} from '@/lib/api-validation-middleware';

async function handleGET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const communityId = searchParams.get('communityId');
    const code = searchParams.get('code');

    if (code) {
      // Validate visitor code
      const visitorData = await validateVisitorCode(code);
      return createSuccessResponse({ visitor: visitorData, isValid: !!visitorData });
    }

    if (userId && communityId) {
      // Get user's visitor codes
      const codes = await getVisitorCodes(communityId, userId);
      return createSuccessResponse({ codes });
    }

    return createErrorResponse('Missing required parameters', 400);
  } catch (error) {
    console.error('Error in visitors API:', error);
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
    const body = request.parsedBody;
    const { action, ...data } = body;

    // Sanitize input data
    const sanitizedData = sanitizeInput(data);

    if (action === 'create_code') {
      if (!sanitizedData.communityId || !sanitizedData.visitorName) {
        return createErrorResponse('Community ID and visitor name are required', 400);
      }
      
      // Set expiry date (24 hours after visit date, or visit date + 2 hours if same day)
      const visitDate = new Date(sanitizedData.visitDate);
      const now = new Date();
      const isToday = visitDate.toDateString() === now.toDateString();
      
      // If visit is today, expire 2 hours after visit time, otherwise expire end of visit day
      const expiresAt = isToday 
        ? new Date(visitDate.getTime() + (2 * 60 * 60 * 1000)) // 2 hours after visit
        : new Date(visitDate.getTime() + (24 * 60 * 60 * 1000)); // 24 hours after visit
      
      const result = await createVisitorCode({
        ...sanitizedData,
        createdBy: userId, // Map userId to createdBy for the database
        expiresAt,
        isUsed: false,
        createdAt: new Date()
      });
      
      return createSuccessResponse({ 
        codeId: result.id, 
        code: result.code 
      }, 'Visitor code created successfully');
    }

    if (action === 'mark_used') {
      const { codeId } = sanitizedData;
      
      if (!codeId) {
        return createErrorResponse('Code ID is required', 400);
      }
      
      await updateDocument('visitorCodes', codeId, { 
        isUsed: true, 
        usedAt: new Date() 
      });
      return createSuccessResponse({}, 'Visitor code marked as used');
    }

    return createErrorResponse('Invalid action', 400);
  } catch (error) {
    console.error('Error in visitors POST:', error);
    return createErrorResponse(error.message, 500);
  }
}

// Apply security middleware with global rate limiting
export const GET = withApiSecurity(handleGET, {
  rateLimitType: 'global'
});

export const POST = withApiSecurity(handlePOST, {
  rateLimitType: 'global',
  requiredFields: ['action'],
  validateBody: true
});