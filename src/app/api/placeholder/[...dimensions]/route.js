import { NextResponse } from 'next/server';

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
    return NextResponse.json({ error: 'Failed to generate placeholder' }, { status: 500 });
  }
}