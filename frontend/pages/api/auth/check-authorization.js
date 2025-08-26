// pages/api/auth/check-authorization.js

// Import from shared module
import { pendingAuths } from '../../../lib/auth-store';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ message: 'Token required' });
  }

  const authData = pendingAuths.get(token);

  if (!authData) {
    return res.status(404).json({ message: 'Authorization not found' });
  }

  // Clean up old pending auths
  for (const [t, data] of pendingAuths.entries()) {
    if (Date.now() - data.timestamp > 600000) { // 10 minutes
      pendingAuths.delete(t);
    }
  }

  res.status(200).json({
    authorized: authData.authorized,
    email: authData.email,
    name: authData.name
  });
}