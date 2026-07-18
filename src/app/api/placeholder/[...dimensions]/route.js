export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

function errorResponse(message, code = 'INTERNAL_ERROR', status = 500) {
  return NextResponse.json({ success: false, error: message, code }, { status });
}

async function authFailureResponse(authError, fallbackCode = 'UNAUTHORIZED') {
  const status = authError?.status || 401;
  let message = status === 403 ? 'Forbidden' : status === 503 ? 'Authentication service unavailable' : 'Unauthorized';

  try {
    const payload = await authError.clone().json();
    if (typeof payload?.error === 'string' && payload.error.trim()) {
      message = payload.error;
    }
  } catch {
    // Keep fallback message.
  }

  const code =
    status === 401 ? 'UNAUTHORIZED' :
    status === 403 ? 'FORBIDDEN' :
    status === 404 ? 'NOT_FOUND' :
    status === 503 ? 'SERVICE_UNAVAILABLE' :
    fallbackCode;

  return errorResponse(message, code, status);
}



export async function GET(request, { params }) {
  try {
    const dimensions = params.dimensions;
    let width = 400;
    let height = 400;
    
    if (dimensions && dimensions.length >= 1) {
      width = parseInt(dimensions[0]) || 400;
      if (dimensions.length >= 2) {
        height = parseInt(dimensions[1]) || 400;
      } else {
        height = width; // Square if only one dimension provided
      }
    }
    
    // Create a simple SVG placeholder
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f3f4f6"/>
        <g fill="#9ca3af" text-anchor="middle" font-family="system-ui, sans-serif" font-size="14">
          <text x="50%" y="45%">${width} × ${height}</text>
          <text x="50%" y="55%" font-size="12">No Image</text>
        </g>
      </svg>
    `;
    
    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=86400', // Cache for 1 day
      },
    });
    
  } catch (error) {
    console.error('Error generating placeholder:', error);
    return errorResponse('Failed to generate placeholder', 'INTERNAL_ERROR', 500);
  }
}