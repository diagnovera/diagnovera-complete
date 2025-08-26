// pages/api/auth/authorize.js
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send('Invalid request');
  }

  try {
    // Verify and decode token - the token contains all the user data
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Extract user data from the token
    const { email, name, image, timestamp } = decoded;

    // Check if token is expired (10 minutes)
    const now = Date.now();
    if (now - timestamp > 600000) {
      return res.status(400).send('Authorization link has expired');
    }

    // Create a new authorized token that the frontend can use
    const authorizedToken = jwt.sign(
      {
        email,
        name,
        image,
        authorized: true,
        authorizedAt: now
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' } // User session valid for 24 hours
    );

    // Send success page with redirect
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authorization Successful</title>
        <script>
          // Store the authorized token and redirect
          localStorage.setItem('authToken', '${authorizedToken}');
          localStorage.setItem('userEmail', '${email}');
          localStorage.setItem('userName', '${name || ''}');
          localStorage.setItem('userImage', '${image || ''}');

          // Redirect to home after storing data
          setTimeout(() => {
            window.location.href = '${process.env.NEXTAUTH_URL}/?authorized=true';
          }, 2000);
        </script>
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
            ${image ? `<img src="${image}" alt="${name}">` : ''}
            <p class="email">${email}</p>
            ${name ? `<p><strong>${name}</strong></p>` : ''}
          </div>
          <p>The user can now access DiagnoVera.</p>
          <p style="margin-top: 20px; color: #9ca3af;">Redirecting...</p>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Authorization error:', error);

    // Provide more specific error messages
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
            <p>Please request a new login attempt.</p>
          </div>
        </body>
        </html>
      `);
    } else if (error.name === 'JsonWebTokenError') {
      res.status(400).send('Invalid authorization link');
    } else {
      res.status(400).send('Authorization failed');
    }
  }
}