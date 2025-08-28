// pages/api/auth/status.js
import jwt from 'jsonwebtoken';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }

  try {
    console.log('Checking authorization status for:', email);

    // Check Redis for authorization
    const authDataStr = await redis.get(`auth:${email}`);
    
    if (!authDataStr) {
      console.log('No authorization found for:', email);
      return res.status(401).json({ 
        authorized: false, 
        message: 'Not authorized. Please wait for admin approval.' 
      });
    }

    console.log('Auth data found:', authDataStr);
    const authData = JSON.parse(authDataStr);

    if (!authData.authorized) {
      return res.status(401).json({ 
        authorized: false, 
        message: 'Authorization pending' 
      });
    }

    // Check if authorization is still valid (24 hours)
    const now = Date.now();
    const age = now - authData.authorizedAt;
    
    if (age > 86400000) { // 24 hours
      // Remove expired authorization
      await redis.del(`auth:${email}`);
      return res.status(401).json({ 
        authorized: false, 
        message: 'Authorization expired. Please login again.' 
      });
    }

    // Create/refresh session token
    const sessionToken = jwt.sign(
      {
        email: authData.email,
        name: authData.name,
        image: authData.image,
        authorized: true,
        authorizedAt: authData.authorizedAt
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('Authorization confirmed for:', email);

    res.status(200).json({
      authorized: true,
      user: {
        email: authData.email,
        name: authData.name,
        image: authData.image
      },
      sessionToken,
      message: 'Access granted'
    });

  } catch (error) {
    console.error('Error checking auth status:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      authorized: false 
    });
  }
}