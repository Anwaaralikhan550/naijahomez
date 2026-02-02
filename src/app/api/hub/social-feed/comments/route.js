import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';

export async function GET(request) {
  try {
    // Initialize admin SDK
    const db = getAdminFirestore();

    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId');
    const limit = parseInt(searchParams.get('limit')) || 5;

    if (!postId) {
      return NextResponse.json({ error: 'Post ID is required' }, { status: 400 });
    }

    // Load comments for specific post
    const commentsQuery = db.collection('socialComments')
      .where('postId', '==', postId)
      .orderBy('createdAt', 'asc')
      .limit(limit);
    
    const commentsSnapshot = await commentsQuery.get();
    const comments = [];
    
    commentsSnapshot.forEach((commentDoc) => {
      comments.push({ 
        id: commentDoc.id, 
        ...commentDoc.data(),
        createdAt: commentDoc.data().createdAt?.toDate?.().toISOString() || commentDoc.data().createdAt
      });
    });

    return NextResponse.json({ comments });
  } catch (error) {
    console.error('Error loading comments:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}