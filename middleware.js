// middleware.js
import { NextResponse } from 'next/server';

export function middleware(request) {
  const path = request.nextUrl.pathname;
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Define protected routes
  const protectedPaths = [
    '/diagnoveraenterpriseinterface',
    '/dashboard',
    '/admin',
    '/debug'
  ];
  
  // Check if current path needs protection
  const isProtectedPath = protectedPaths.some(protectedPath => 
    path === protectedPath || path.startsWith(`${protectedPath}/`)
  );
  
  if (!isProtectedPath) {
    return NextResponse.next();
  }

  if (isDevelopment) {
    console.log('Middleware: Checking protected path:', path);
  }
  
  // Get auth token from cookies
  const authToken = request.cookies.get('authToken');

  if (!authToken) {
    if (isDevelopment) {
      console.log('Middleware: No auth token found, redirecting to login');
    }
    return NextResponse.redirect(new URL('/?status=auth-required', request.url));
  }

  try {
    let decoded;
    let isBase64Token = false;

    // Try to decode as base64 first (your custom session tokens)
    try {
      const decodedString = Buffer.from(authToken.value, 'base64').toString();
      decoded = JSON.parse(decodedString);
      isBase64Token = true;
      
      if (isDevelopment) {
        console.log('Middleware: Decoded base64 token for:', decoded.email);
      }
    } catch (base64Error) {
      // Not a base64 token, might be JWT or other format
      // For JWT tokens, we can't fully verify without the secret in middleware
      // So we'll do a basic check and let the app handle full verification
      
      if (authToken.value.split('.').length === 3) {
        // Looks like a JWT token (has 3 parts separated by dots)
        if (isDevelopment) {
          console.log('Middleware: JWT token detected, allowing access for app verification');
        }
        return NextResponse.next();
      } else {
        // Not a valid token format
        throw new Error('Invalid token format');
      }
    }
    
    // For base64 tokens, perform full validation
    if (isBase64Token) {
      // Check if user is authorized
      if (!decoded.authorized) {
        if (isDevelopment) {
          console.log('Middleware: User not authorized');
        }
        return NextResponse.redirect(new URL('/?status=unauthorized', request.url));
      }

      // Check token expiration (24 hours)
      const now = Date.now();
      const authTime = decoded.authorizedAt || decoded.timestamp || 0;
      
      if (authTime === 0) {
        // No timestamp, treat as invalid
        throw new Error('Token missing timestamp');
      }
      
      const age = now - authTime;
      const maxAge = 86400000; // 24 hours in milliseconds
      
      if (age > maxAge) {
        if (isDevelopment) {
          console.log('Middleware: Token expired, age:', Math.round(age / 3600000), 'hours');
        }
        
        // Clear expired cookie and redirect
        const response = NextResponse.redirect(new URL('/?status=expired', request.url));
        response.cookies.delete('authToken');
        return response;
      }

      // Valid token, allow access
      if (isDevelopment) {
        console.log('Middleware: Access granted for:', decoded.email);
      }
      return NextResponse.next();
    }

  } catch (error) {
    if (isDevelopment) {
      console.error('Middleware: Token verification error:', error.message);
    }
    
    // Clear invalid cookie and redirect
    const response = NextResponse.redirect(new URL('/?status=invalid-token', request.url));
    response.cookies.delete('authToken');
    return response;
  }

  // Default: allow access (shouldn't reach here)
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (except protected ones)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, robots.txt (static files)
     * - public folder
     */
    '/((?!api/auth|api/public|_next/static|_next/image|favicon.ico|robots.txt|public).*)',
  ]
};