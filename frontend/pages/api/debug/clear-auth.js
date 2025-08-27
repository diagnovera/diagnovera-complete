import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  try {
    // Clear all auth keys
    const keys = await redis.keys('auth:*');
    console.log('Found auth keys:', keys);

    for (const key of keys) {
      await redis.del(key);
    }

    res.json({
      success: true,
      cleared: keys.length,
      message: `Cleared ${keys.length} auth entries`,
      keys: keys
    });
  } catch (error) {
    console.error('Redis clear error:', error);
    res.status(500).json({ error: error.message });
  }
}