import { NextResponse } from 'next/server';
import { verifyAuth, isAdmin } from '@/lib/auth-middleware';
import { 
  createMarketplaceItem,
  getMarketplaceItems,
  updateDocument,
  deleteDocument 
} from '@/lib/hubFirestore';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const communityId = searchParams.get('communityId');

    if (!communityId) {
      return NextResponse.json({ error: 'Community ID is required' }, { status: 400 });
    }

    const items = await getMarketplaceItems(communityId);
    return NextResponse.json({ items });
  } catch (error) {
    console.error('Error in marketplace API:', error);
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

    if (action === 'create_item') {
      const itemId = await createMarketplaceItem(data);
      return NextResponse.json({ success: true, itemId });
    }

    if (action === 'update_item') {
      const { itemId, ...updateData } = data;
      await updateDocument('hubMarketplace', itemId, updateData);
      return NextResponse.json({ success: true });
    }

    if (action === 'delete_item') {
      const { itemId } = data;
      await deleteDocument('hubMarketplace', itemId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in marketplace POST:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}