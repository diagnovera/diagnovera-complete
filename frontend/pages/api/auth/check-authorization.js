import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  console.log('Check-authorization called with body:', req.body);

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email) {
    console.error('No email provided in request');
    return res.status(400).json({ message: 'Email required' });
  }

  try {
    const key = `auth:${email}`;
    console.log(`Checking Redis for key: ${key}`);

    const authDataStr = await redis.get(key);
    console.log(`Redis response:`, authDataStr);

    if (authDataStr) {
      const authData = typeof authDataStr === 'string'
        ? JSON.parse(authDataStr)
        : authDataStr;

      if (authData.authorized) {
        console.log(`${email} is authorized`);
        return res.status(200).json({
          authorized: true,
          email: authData.email,
          name: authData.name,
          image: authData.image
        });
      }
    }

    console.log(`${email} is not authorized`);
    return res.status(200).json({
      authorized: false,
      email: email
    });
  } catch (error) {
    console.error('Redis error:', error);
    return res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
}