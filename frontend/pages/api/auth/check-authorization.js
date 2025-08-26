// pages/api/auth/check-authorization.js
import jwt from 'jsonwebtoken';

// In-memory store for authorized tokens (will reset on server restart)
const authorizedTokens = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { token, email } = req.body;

  // Check by token (used after admin clicks authorize)
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Mark this token as authorized
      authorizedTokens.set(token, {
        email: decoded.email,
        name: decoded.name,
        image: decoded.image,
        authorized: true,
        timestamp: Date.now()
      });

      return res.status(200).json({
        authorized: true,
        email: decoded.email,
        name: decoded.name,
        image: decoded.image
      });
    } catch (error) {
      // Token invalid or expired
      return res.status(200).json({ authorized: false });
    }
  }

  // Check by email - see if any token for this email was authorized
  if (email) {
    // Look through authorized tokens for this email
    for (const [storedToken, data] of authorizedTokens.entries()) {
      if (data.email === email && data.authorized) {
        // Check if not expired (10 minutes)
        if (Date.now() - data.timestamp < 600000) {
          return res.status(200).json({
            authorized: true,
            email: data.email,
            name: data.name,
            image: data.image
          });
        } else {
          // Expired, remove it
          authorizedTokens.delete(storedToken);
        }
      }
    }

    return res.status(200).json({
      authorized: false,
      email: email
    });
  }

  return res.status(400).json({ message: 'Token or email required' });
}

export { authorizedTokens };