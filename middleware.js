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
      // Try to decode the token
      let decoded;
      try {
        // Use Buffer.from instead of atob (Node.js compatible)
        decoded = JSON.parse(Buffer.from(authToken.value, 'base64').toString());
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
      
      if (age > 86400000) { // 24 hours in milliseconds
        console.log('Authorization expired - redirecting to homepage');
        // Clear the expired cookie
        const response = NextResponse.redirect(new URL('/?status=expired', request.url));
        response.cookies.delete('authToken');
        return response;
      }

      console.log('Authorization verified - allowing access');
      return NextResponse.next();
    } catch (error) {
      console.error('Token verification failed:', error.message);
      // Clear the invalid cookie
      const response = NextResponse.redirect(new URL('/?status=invalid-token', request.url));
      response.cookies.delete('authToken');
      return response;
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
      // Use Buffer.from instead of atob
      const decoded = JSON.parse(Buffer.from(authToken.value, 'base64').toString());
      
      if (!decoded.authorized) {
        return NextResponse.redirect(new URL('/?status=unauthorized', request.url));
      }

      // Check expiration for these routes too
      const now = Date.now();
      const authTime = decoded.authorizedAt || decoded.timestamp || now;
      const age = now - authTime;
      
      if (age > 86400000) { // 24 hours
        const response = NextResponse.redirect(new URL('/?status=expired', request.url));
        response.cookies.delete('authToken');
        return response;
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
    '/diagnoveraenterpriseinterface',
    '/dashboard/:path*', 
    '/admin/:path*',
    '/debug/:path*'
  ]
}