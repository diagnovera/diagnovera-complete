// pages/api/debug/redis.js
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
    const rawData = await redis.get(authKey);
    
    return res.status(200).json({
      email: email,
      key: authKey,
      exists: rawData !== null,
      rawDataType: typeof rawData,
      rawData: rawData,
      parsedData: rawData ? (typeof rawData === 'string' ? JSON.parse(rawData) : rawData) : null
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message,
      email: email
    });
  }
}