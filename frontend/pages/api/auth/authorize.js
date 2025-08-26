// pages/api/auth/authorize.js
import jwt from 'jsonwebtoken';

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

    // Admin is authorizing ANOTHER user - just show success
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
          .success-icon {
            width: 60px;
            height: 60px;
            margin: 0 auto 20px;
            background: #10b981;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success-icon">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <h1>Authorization Successful</h1>
          <p>You have successfully authorized access for:</p>
          <div class="user-info">
            ${image ? `<img src="${image}" alt="${name}">` : ''}
            <p class="email">${email}</p>
            ${name ? `<p><strong>${name}</strong></p>` : ''}
          </div>
          <p>The user has been granted access to DiagnoVera.</p>
          <p style="margin-top: 30px; font-size: 14px; color: #9ca3af;">You can close this window.</p>
        </div>
      </body>
      </html>
    `);

    // Here you would typically update a database to mark this user as authorized
    // For now, we'll use a simple file or memory store

  } catch (error) {
    console.error('Authorization error:', error);

    if (error.name === 'TokenExpiredError') {
      res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Link Expired</title>
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
            h1 { color: #ef4444; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>❌ Link Expired</h1>
            <p>This authorization link has expired.</p>
            <p>The user will need to request access again.</p>
          </div>
        </body>
        </html>
      `);
    } else {
      res.status(400).send('Invalid authorization link');
    }
  }
}