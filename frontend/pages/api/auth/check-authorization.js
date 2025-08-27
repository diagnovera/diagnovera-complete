import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email required' });
  }

  try {
    // Check if email is authorized in KV store
    const authData = await kv.get(`auth:${email}`);

    if (authData && authData.authorized) {
      return res.status(200).json({
        authorized: true,
        email: authData.email,
        name: authData.name,
        image: authData.image
      });
    }

    return res.status(200).json({
      authorized: false,
      email: email
    });
  } catch (error) {
    console.error('KV error:', error);
    return res.status(200).json({
      authorized: false,
      email: email
    });
  }
}