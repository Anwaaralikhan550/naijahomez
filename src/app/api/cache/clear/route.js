export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth-middleware';
import cache from '@/lib/cache';

const ensureAdmin = async (request) => {
  const adminResult = await isAdmin(request);
  if (!adminResult.success) {
    return adminResult.error;
  }
  return null;
};

export async function POST(request) {
  try {
    const adminError = await ensureAdmin(request);
    if (adminError) return adminError;

    cache.clear();

    return NextResponse.json({
      success: true,
      message: 'Cache cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    return NextResponse.json(
      { error: 'Failed to clear cache' },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const adminError = await ensureAdmin(request);
    if (adminError) return adminError;

    cache.clear();

    return NextResponse.json({
      success: true,
      message: 'Cache cleared successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    return NextResponse.json(
      { error: 'Failed to clear cache' },
      { status: 500 }
    );
  }
}
