// auth.js (fixed)
const BASE_URL =
  process.env.AUTH_URL ||            // Auth.js v5
  process.env.NEXTAUTH_URL ||        // NextAuth v4
  'http://localhost:3000';

export const GOOGLE_CALLBACK_URL = `${BASE_URL}/api/auth/callback/google`;
