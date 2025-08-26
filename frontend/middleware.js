// middleware.js
import { NextResponse } from 'next/server';

export function middleware(request) {
  // Only protect dashboard and other app routes
  if (request.nextUrl.pathname.startsWith('/dashboard') ||
      request.nextUrl.pathname.startsWith('/debug')) {

    const authToken = request.cookies.get('authToken');

    if (!authToken) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    // In production, verify the token here
    // For now, just check if it exists
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/debug/:path*']
};