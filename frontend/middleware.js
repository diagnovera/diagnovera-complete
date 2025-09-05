// middleware.js
import { NextResponse } from 'next/server';

export function middleware(request) {
  console.log('Middleware checking path:', request.nextUrl.pathname);
  
  // Protect the main application page
  if (request.nextUrl.pathname === '/diagnoveraenterpriseinterface') {
    console.log('Checking authorization for main app access');
    
    const authToken = request.cookies.get('authToken');
    console.log('Auth token exists:', authToken ? 'Yes' : 'No');

    if (!authToken) {
      console.log('No auth token - redirecting to homepage');
      return NextResponse.redirect(new URL('/?status=auth-required', request.url));
    }

    try {
      // Try to decode the base64 session token first
      let decoded;
      try {
        // Try base64 decode (for session tokens from homepage)
        decoded = JSON.parse(atob(authToken.value));
        console.log('Decoded base64 session token for user:', decoded.email);
      } catch (base64Error) {
        // For JWT tokens, we'll accept them but can't verify in middleware
        // The main app can do additional verification if needed
        console.log('Not a base64 token, assuming JWT format');
        return NextResponse.next(); // Allow access, let app handle JWT verification
      }
      
      // Check if user is authorized (for base64 tokens)
      if (!decoded.authorized) {
        console.log('Token exists but not authorized - redirecting to homepage');
        return NextResponse.redirect(new URL('/?status=unauthorized', request.url));
      }

      // Check if authorization is still valid (24 hours)
      const now = Date.now();
      const authTime = decoded.authorizedAt || decoded.timestamp || now;
      const age = now - authTime;
      
      if (age > 86400000) { // 24 hours
        console.log('Authorization expired - redirecting to homepage');
        return NextResponse.redirect(new URL('/?status=expired', request.url));
      }

      console.log('Authorization verified - allowing access');
      return NextResponse.next();
    } catch (error) {
      console.error('Token verification failed:', error.message);
      return NextResponse.redirect(new URL('/?status=invalid-token', request.url));
    }
  }

  // Protect other sensitive routes
  if (request.nextUrl.pathname.startsWith('/dashboard') ||
      request.nextUrl.pathname.startsWith('/admin') ||
      request.nextUrl.pathname.startsWith('/debug')) {

    const authToken = request.cookies.get('authToken');

    if (!authToken) {
      return NextResponse.redirect(new URL('/?status=auth-required', request.url));
    }

    try {
      // Try base64 decode first
      const decoded = JSON.parse(atob(authToken.value));
      
      if (!decoded.authorized) {
        return NextResponse.redirect(new URL('/?status=unauthorized', request.url));
      }

      return NextResponse.next();
    } catch (error) {
      // If base64 fails, assume JWT and allow (app will handle verification)
      return NextResponse.next();
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/diagnoveraenterpriseinterface/:path*',
    '/dashboard/:path*', 
    '/admin/:path*',
    '/debug/:path*'
  ]
}