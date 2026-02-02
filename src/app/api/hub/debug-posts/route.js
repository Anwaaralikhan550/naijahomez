import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';

export async function GET(request) {
  try {
    // Initialize admin SDK
    const db = getAdminFirestore();

    const { searchParams } = new URL(request.url);
    const communityId = searchParams.get('communityId');

    if (!communityId) {
      return NextResponse.json({ error: 'Community ID is required' }, { status: 400 });
    }


    // Get all posts for this community
    const querySnapshot = await db.collection('socialPosts')
      .where('communityId', '==', communityId)
      .where('isActive', '==', true)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    const posts = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      posts.push({
        id: doc.id,
        type: data.type,
        content: data.content?.substring(0, 50) + '...',
        createdAt: data.createdAt,
        authorName: data.authorName
      });
    });


    return NextResponse.json({ 
      communityId,
      totalPosts: posts.length,
      posts,
      typeBreakdown: posts.reduce((acc, post) => {
        acc[post.type] = (acc[post.type] || 0) + 1;
        return acc;
      }, {})
    });
  } catch (error) {
    console.error('Error in debug posts GET:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}