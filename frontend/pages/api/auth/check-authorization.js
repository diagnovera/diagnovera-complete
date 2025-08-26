// pages/api/auth/check-authorization.js
import jwt from 'jsonwebtoken';

// Store authorized tokens in memory (lasts only for current function instance)
const authorizedTokens = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ message: 'Token required' });
  }

  try {
    // Verify the token is valid
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if this specific token has been authorized
    if (authorizedTokens.has(token)) {
      return res.status(200).json({
        authorized: true,
        email: decoded.email,
        name: decoded.name,
        image: decoded.image
      });
    }

    // Not authorized yet
    return res.status(200).json({
      authorized: false,
      email: decoded.email
    });

  } catch (error) {
    return res.status(404).json({ message: 'Invalid or expired token' });
  }
}

// Export for authorize.js to use
export { authorizedTokens };