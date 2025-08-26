// pages/api/auth/check-authorization.js
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ message: 'Token required' });
  }

  try {
    // Check if this is an authorized token from localStorage
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // If token has 'authorized' field, it's from authorize.js
    if (decoded.authorized) {
      return res.status(200).json({
        authorized: true,
        email: decoded.email,
        name: decoded.name,
        image: decoded.image
      });
    }

    // Otherwise, still waiting for authorization
    return res.status(200).json({
      authorized: false,
      email: decoded.email,
      name: decoded.name
    });

  } catch (error) {
    // Token is invalid or expired
    return res.status(404).json({ message: 'Authorization not found or expired' });
  }
}