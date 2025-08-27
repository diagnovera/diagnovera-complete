import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  console.log('Check-authorization called with body:', req.body);

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { email } = req.body;

  // Better validation with more specific error messages
  if (!email || email.trim() === '' || email === 'undefined' || email === 'null') {
    console.error('Invalid email provided:', { email, type: typeof email });
    return res.status(400).json({
      message: 'Valid email required',
      provided: email,
      authorized: false
    });
  }

  try {
    const key = `auth:${email}`;
    console.log(`Checking Redis for key: ${key}`);

    const authDataStr = await redis.get(key);
    console.log(`Redis response for ${email}:`, authDataStr);

    if (authDataStr) {
      const authData = typeof authDataStr === 'string'
        ? JSON.parse(authDataStr)
        : authDataStr;

      if (authData.authorized) {
        console.log(`${email} is authorized`);

        // Generate a simple token for the session
        const token = `auth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        return res.status(200).json({
          authorized: true,
          email: authData.email,
          name: authData.name,
          image: authData.image,
          token: token
        });
      }
    }

    console.log(`${email} is not authorized or not found`);
    return res.status(200).json({
      authorized: false,
      email: email
    });
  } catch (error) {
    console.error('Redis error:', error);
    return res.status(500).json({
      message: 'Server error',
      error: error.message,
      authorized: false
    });
  }
}