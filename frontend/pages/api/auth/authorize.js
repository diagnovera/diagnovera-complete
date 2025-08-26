// pages/api/auth/authorize.js
import jwt from 'jsonwebtoken';

// Import from NextAuth - we'll create a shared module for pendingAuths
import { pendingAuths } from '../../../lib/auth-store';

export default async function handler(req, res) {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send('Invalid request');
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if authorization exists
    const authData = pendingAuths.get(token);
    if (!authData) {
      return res.status(404).send('Authorization request not found or expired');
    }

    // Mark as authorized
    pendingAuths.set(token, {
      ...authData,
      authorized: true
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
          p {
            color: #6b7280;
            margin-bottom: 10px;
          }
          .email {
            font-weight: bold;
            color: #374151;
            background: #f3f4f6;
            padding: 8px 16px;
            border-radius: 6px;
            display: inline-block;
            margin: 10px 0;
          }
          .user-info {
            margin: 20px 0;
            padding: 20px;
            background: #f9fafb;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
          }
          .user-info img {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            margin-bottom: 10px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>✓ Authorization Successful</h1>
          <p>You have successfully authorized login for:</p>
          <div class="user-info">
            ${authData.image ? `<img src="${authData.image}" alt="${authData.name}">` : ''}
            <p class="email">${authData.email}</p>
            ${authData.name ? `<p><strong>${authData.name}</strong></p>` : ''}
          </div>
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