// pages/api/auth/google-oauth.js
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';

// Email transporter
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD
  }
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({ error: 'No credential provided' });
  }

  try {
    // Decode the Google JWT (without verification for demo - in production, verify with Google's public keys)
    const decoded = jwt.decode(credential);
    
    if (!decoded || !decoded.email) {
      return res.status(400).json({ error: 'Invalid credential' });
    }

    const { email, name, picture } = decoded;

    // Only allow Gmail accounts
    if (!email.endsWith('@gmail.com')) {
      return res.status(400).json({ 
        error: 'Only Gmail accounts are allowed',
        message: 'Please use a Gmail account to sign in' 
      });
    }

    // Generate authorization token
    const authToken = jwt.sign(
      {
        email,
        name,
        image: picture,
        timestamp: Date.now()
      },
      process.env.JWT_SECRET,
      { expiresIn: '10m' }
    );

    // Create authorization link
    const authLink = `${process.env.NEXTAUTH_URL}/api/auth/authorize?token=${authToken}`;

    // Send email notification to admin
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: 'ghajarmehrdad@gmail.com',
      subject: 'DiagnoVera Login Authorization Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4f46e5;">DiagnoVera Login Request</h2>
          <p>A Gmail user is requesting access to DiagnoVera:</p>
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Name:</strong> ${name || 'N/A'}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            ${picture ? `<img src="${picture}" alt="${name}" style="width: 50px; height: 50px; border-radius: 50%; margin-top: 10px;">` : ''}
          </div>
          <p>Click the button below to authorize this login:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${authLink}" style="background: #4f46e5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Authorize Login
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">This link will expire in 10 minutes.</p>
        </div>
      `
    });

    console.log(`Admin email sent for user: ${email}`);

    return res.status(200).json({
      success: true,
      email: email,
      name: name,
      message: 'Authorization request sent to admin'
    });

  } catch (error) {
    console.error('Google OAuth error:', error);
    return res.status(500).json({ 
      error: 'Failed to process Google sign-in',
      message: 'Please try again' 
    });
  }
}