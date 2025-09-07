// pages/api/debug/clear-auth.js
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
    const authKey = `auth:${email}`;
    
    // Check if data exists before deletion
    const existingData = await redis.get(authKey);
    
    // Delete the authorization data
    const result = await redis.del(authKey);
    
    return res.status(200).json({
      message: 'Authorization data cleared',
      email: email,
      key: authKey,
      existedBefore: existingData !== null,
      deletionResult: result,
      existingData: existingData
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message,
      email: email
    });
  }
}