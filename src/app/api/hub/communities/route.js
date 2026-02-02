import { NextResponse } from 'next/server';
import { verifyAuth, isAdmin } from '@/lib/auth-middleware';
import {
  createHubCommunity,
  getHubCommunity,
  searchHubCommunities,
  createHubMember,
  getHubMember,
  getUserCommunities,
  getPublicCommunities
} from '@/lib/hubFirestore';
import logger from '@/lib/logger';

export async function GET(request) {
  try {
    // Verify authentication for sensitive operations
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const communityId = searchParams.get('id');
    const userId = searchParams.get('userId');
    const type = searchParams.get('type'); // 'user' for user's communities, 'public' for top public communities

    console.log('Communities GET request:', { search, communityId, userId, type, url: request.url });

    // Authentication required for user-specific data
    if (type === 'user' || userId) {
      const authResult = await verifyAuth(request);
      if (!authResult.success) {
        return authResult.error;
      }
      
      // Ensure user can only access their own data
      if (userId && authResult.userId !== userId) {
        return NextResponse.json({ error: 'Unauthorized access to user data' }, { status: 403 });
      }
    }

    if (communityId && userId) {
      // Get user's membership in specific community
      const member = await getHubMember(userId, communityId);
      return NextResponse.json({ member });
    }

    if (communityId) {
      // Get specific community
      const community = await getHubCommunity(communityId);
      return NextResponse.json({ community });
    }

    if (search) {
      // Search communities
      const communities = await searchHubCommunities(search);
      return NextResponse.json({ communities });
    }

    if (type === 'user' && userId) {
      // Get user's communities
      const communities = await getUserCommunities(userId);
      return NextResponse.json({ communities });
    }

    if (type === 'public') {
      // Get top public communities
      const communities = await getPublicCommunities(5);
      return NextResponse.json({ communities });
    }

    // If no specific parameters, return empty array
    console.log('No specific parameters provided, returning empty communities list');
    return NextResponse.json({ communities: [] });
  } catch (error) {
    logger.error('Error in communities API', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const userId = authResult.userId;
    const body = await request.json();
    const { action, ...data } = body;

    if (action === 'create_community') {
      // Validate required fields
      const { name, description, location, isPublic } = data;
      
      if (!name || !description || !location) {
        return NextResponse.json({ 
          error: 'Missing required fields', 
          missing: {
            name: !name,
            description: !description,
            location: !location
          }
        }, { status: 400 });
      }
      
      // Validate field lengths
      if (name.length > 100 || description.length > 500) {
        return NextResponse.json({ 
          error: 'Field length validation failed',
          details: 'Name must be <= 100 chars, description <= 500 chars'
        }, { status: 400 });
      }
      
      // Sanitize inputs
      const sanitizedData = {
        name: name.trim(),
        description: description.trim(),
        location: location.trim(),
        isPublic: !!isPublic
      };
      
      const communityId = await createHubCommunity({
        ...sanitizedData,
        createdBy: userId,
        adminIds: [userId] // Creator is automatically an admin
      });
      
      // Automatically add creator as admin member
      console.log(`Auto-adding creator ${userId} to community ${communityId} as admin`);
      const memberId = await createHubMember({
        userId: userId,
        communityId: communityId,
        role: 'admin',
        status: 'active',
        joinedAt: new Date(),
        permissions: ['read', 'write', 'moderate', 'admin']
      });
      
      console.log(`Created community ${communityId} and auto-added creator ${userId} as admin member ${memberId}`);
      return NextResponse.json({ communityId, memberId, success: true });
    }

    if (action === 'join_community') {
      const { userId, communityId, ...memberData } = data;
      const memberId = await createHubMember({
        userId,
        communityId,
        ...memberData
      });
      return NextResponse.json({ memberId, success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    logger.error('Error in communities POST', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}