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

    // Check if token is expired (10 minutes)
    const now = Date.now();
    const age = now - timestamp;
    if (age > 600000) { // 10 minutes
      return res.status(400).send(`
        <html><body style="font-family: Arial; text-align: center; padding: 50px;">
          <h2>Authorization Link Expired</h2>
          <p>This link expired ${Math.round(age / 60000)} minutes after creation.</p>
          <p>Please request a new login.</p>
        </body></html>
      `);
    }

    // Store authorization in Redis - this allows the USER'S browser to detect approval
    const authData = {
      email,
      name,
      image,
      authorized: true,
      authorizedAt: now,
      authorizedBy: 'ghajarmehrdad@gmail.com'
    };

    // Store with 24 hour expiration
    await redis.set(`auth:${email}`, JSON.stringify(authData), { ex: 86400 });

    // ADMIN CONFIRMATION PAGE - NO REDIRECT
    // This page is for YOU (the admin) to see confirmation
    // The USER will be redirected by their polling homepage
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
          .user-info {
            background: #f3f4f6;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="checkmark">✓</div>
          <h1>User Authorization Complete</h1>
          
          <div class="user-info">
            <h3>Authorized User:</h3>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          </div>

          <p><strong>The user will be automatically redirected to the application.</strong></p>
          
          <p style="margin-top: 30px; color: #666; font-size: 14px;">
            You can close this window. The user's browser will detect this authorization 
            and automatically redirect them to the DiagnoVera application.
          </p>
        </div>
      </body>
      </html>
    `);

    console.log(`Successfully authorized user: ${email} at ${new Date().toISOString()}`);

  } catch (error) {
    console.error('Authorization error:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(400).send(`
        <html><body style="font-family: Arial; text-align: center; padding: 50px;">
          <h2>Invalid Authorization Link</h2>
          <p>This authorization link is invalid.</p>
          <p>Please request a new login attempt.</p>
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
      return res.status(500).send(`
        <html><body style="font-family: Arial; text-align: center; padding: 50px;">
          <h2>Authorization Error</h2>
          <p>An error occurred during authorization. Please try again.</p>
          <p style="color: #666; font-size: 12px;">Error: ${error.message}</p>
        </body></html>
      `);
    }
  }
}