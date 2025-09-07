// pages/api/auth/google-callback.js
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  const { code, error } = req.query;

  if (error) {
    return res.redirect('/?status=error&message=' + encodeURIComponent(error));
  }

  if (!code) {
    return res.redirect('/?status=error&message=No_authorization_code');
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code: code,
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/google-callback`,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResponse.json();

    if (!tokens.access_token) {
      throw new Error('Failed to get access token');
    }

    // Get user info
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    const userData = await userResponse.json();

    // Only allow Gmail accounts
    if (!userData.email.endsWith('@gmail.com')) {
      return res.redirect('/?status=error&message=Only_Gmail_accounts_allowed');
    }

    // Generate authorization token
    const authToken = jwt.sign(
      {
        email: userData.email,
        name: userData.name,
        image: userData.picture,
        timestamp: Date.now()
      },
      process.env.JWT_SECRET,
      { expiresIn: '30m' }
    );

    // Create authorization link
    const authLink = `${process.env.NEXTAUTH_URL}/api/auth/authorize?token=${encodeURIComponent(authToken)}`;

    // Send email to admin
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
      }
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: 'ghajarmehrdad@gmail.com',
      subject: 'DiagnoVera Login Authorization Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4f46e5;">DiagnoVera Login Request</h2>
          <p>A Gmail user is requesting access:</p>
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Name:</strong> ${userData.name}</p>
            <p><strong>Email:</strong> ${userData.email}</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${authLink}" style="background: #4f46e5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Authorize Login
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">This link expires in 30 minutes.</p>
        </div>
      `
    });

    // Redirect back to homepage with pending status
    res.redirect(`/?status=pending&email=${encodeURIComponent(userData.email)}`);

  } catch (error) {
    console.error('Google callback error:', error);
    res.redirect('/?status=error&message=Authentication_failed');
  }
}