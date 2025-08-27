import jwt from 'jsonwebtoken';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send('Invalid request - no token provided');
  }

  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET not configured');
    return res.status(500).send('Server configuration error');
  }

  try {
    // Verify and decode token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { email, name, image, timestamp } = decoded;

    // Check if token is expired (30 minutes)
    const now = Date.now();
    const age = now - timestamp;
    if (age > 1800000) { // 30 minutes
      return res.status(400).send(`
        <html><body style="font-family: Arial; text-align: center; padding: 50px;">
          <h2>Authorization Link Expired</h2>
          <p>This link expired ${Math.round(age / 60000)} minutes after creation.</p>
          <p>Please request a new login.</p>
        </body></html>
      `);
    }

    // Store authorization in Redis
    const authData = {
      email,
      name,
      image,
      authorized: true,
      authorizedAt: now
    };

    await redis.set(`auth:${email}`, JSON.stringify(authData), { ex: 3600 });

    // Success response - ONLY show confirmation to admin, NO redirect
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
          h1 { color: #10b981; }
          .checkmark {
            font-size: 48px;
            color: #10b981;
            margin-bottom: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="checkmark">✓</div>
          <h1>Authorization Successful</h1>
          <p>You have successfully authorized access for:</p>
          <p><strong>${email}</strong></p>
          <p style="margin-top: 20px;">The user will be automatically logged into DiagnoVera.</p>
          <p style="margin-top: 30px; color: #666; font-size: 14px;">
            You can close this window. The user's browser will detect this authorization and redirect them automatically.
          </p>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Authorization error:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(400).send(`
        <html><body style="font-family: Arial; text-align: center; padding: 50px;">
          <h2>Invalid Authorization Link</h2>
          <p>This authorization link is invalid.</p>
          <p>Error: ${error.message}</p>
        </body></html>
      `);
    } else if (error.name === 'TokenExpiredError') {
      return res.status(400).send(`
        <html><body style="font-family: Arial; text-align: center; padding: 50px;">
          <h2>Authorization Link Expired</h2>
          <p>This link has expired. Please request a new login.</p>
        </body></html>
      `);
    } else {
      return res.status(400).send('Authorization failed: ' + error.message);
    }
  }
}