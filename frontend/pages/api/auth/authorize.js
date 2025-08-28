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

    // Check if token is expired (10 minutes as per your NextAuth config)
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

    // Store authorization in Redis with the user's data
    const authData = {
      email,
      name,
      image,
      authorized: true,
      authorizedAt: now,
      authorizedBy: 'ghajarmehrdad@gmail.com'
    };

    // Store with a longer expiration for the session (24 hours)
    await redis.set(`auth:${email}`, JSON.stringify(authData), { ex: 86400 });

    // Create a session token that the client can use
    const sessionToken = jwt.sign(
      {
        email,
        name,
        image,
        authorized: true,
        authorizedAt: now
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Success response with auto-redirect script for the user
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
          .spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #3498db;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            animation: spin 1s linear infinite;
            margin: 20px auto;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
        <script>
          // Store the session token and redirect
          document.addEventListener('DOMContentLoaded', function() {
            try {
              // Store session data in localStorage for the main app to pick up
              localStorage.setItem('diagnovera_session', JSON.stringify({
                email: '${email}',
                name: '${name}',
                image: '${image || ''}',
                authorized: true,
                timestamp: ${now}
              }));

              // Also set a cookie for server-side checks
              document.cookie = 'authToken=${sessionToken}; path=/; max-age=86400; samesite=strict';

              // Redirect to the main application after a short delay
              setTimeout(function() {
                window.location.href = '/diagnoveraenterpriseinterface';
              }, 2000);
            } catch (error) {
              console.error('Error setting session data:', error);
              document.getElementById('status').innerHTML = 
                '<p style="color: red;">Error setting up session. Please try logging in again.</p>';
            }
          });
        </script>
      </head>
      <body>
        <div class="container">
          <div class="checkmark">✓</div>
          <h1>Authorization Successful</h1>
          <div id="status">
            <p>Welcome, <strong>${name}</strong>!</p>
            <p>You have been authorized to access DiagnoVera.</p>
            <div class="spinner"></div>
            <p>Redirecting to the application...</p>
          </div>
          <p style="margin-top: 30px; color: #666; font-size: 14px;">
            If you are not redirected automatically, 
            <a href="/diagnoveraenterpriseinterface">click here</a>.
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