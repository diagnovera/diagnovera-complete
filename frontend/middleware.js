// middleware.js
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

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
      // Verify the JWT token
      const decoded = jwt.verify(authToken.value, process.env.JWT_SECRET);
      console.log('Token verified for user:', decoded.email);
      
      // Check if user is authorized
      if (!decoded.authorized) {
        console.log('Token exists but not authorized - redirecting to homepage');
        return NextResponse.redirect(new URL('/?status=unauthorized', request.url));
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
      const decoded = jwt.verify(authToken.value, process.env.JWT_SECRET);
      
      if (!decoded.authorized) {
        return NextResponse.redirect(new URL('/?status=unauthorized', request.url));
      }

      return NextResponse.next();
    } catch (error) {
      return NextResponse.redirect(new URL('/?status=invalid-token', request.url));
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