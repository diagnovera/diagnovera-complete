// pages/api/auth/authorize.js
import jwt from 'jsonwebtoken';
import { authorizedTokens } from './check-authorization';

export default async function handler(req, res) {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send('Invalid request');
  }

  try {
    // Verify and decode token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { email, name, image, timestamp } = decoded;

    // Check if token is expired (10 minutes)
    const now = Date.now();
    if (now - timestamp > 600000) {
      return res.status(400).send('Authorization link has expired');
    }

    // Mark token as authorized in memory
    authorizedTokens.set(token, {
      email,
      name,
      image,
      authorized: true,
      timestamp: now
    });

    // Send success page
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authorization Successful</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background-color: #f3f4f6;
          }
          .container {
            text-align: center;
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            max-width: 500px;
          }
          h1 {
            color: #10b981;
            margin-bottom: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>✓ Authorization Successful</h1>
          <p>You have successfully authorized access for:</p>
          <p><strong>${email}</strong></p>
          <p>The user can now access DiagnoVera.</p>
          <p style="margin-top: 30px; font-size: 14px; color: #9ca3af;">You can close this window.</p>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Authorization error:', error);
    res.status(400).send('Invalid or expired authorization link');
  }
}