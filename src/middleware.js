// middleware.js - Simplified for client-side auth
import { NextResponse } from 'next/server';

export async function middleware(request) {
    const pathname = request.nextUrl.pathname;
    const isApiRoute = pathname.startsWith('/api/');

    // Only handle CORS for API routes - no auth middleware needed
    if (isApiRoute) {
        const response = NextResponse.next();
        response.headers.set('Access-Control-Allow-Credentials', 'true');
        response.headers.set('Access-Control-Allow-Origin', 
            process.env.NODE_ENV === 'production' 
                ? 'https://www.nijahomzs.com' 
                : 'http://localhost:3000'
        );
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        return response;
    }

    return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*']
};