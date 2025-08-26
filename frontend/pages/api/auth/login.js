// pages/api/auth/login.js
import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// Store pending authorizations (in production, use Redis or database)
const pendingAuths = new Map();

// Configure email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Your email
    pass: process.env.EMAIL_APP_PASSWORD // Gmail app password
  }
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { email, password } = req.body;

  try {
    // Basic validation
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    // Generate authorization token
    const authToken = jwt.sign(
      { email, timestamp: Date.now() },
      process.env.JWT_SECRET,
      { expiresIn: '10m' }
    );

    // Store pending authorization
    pendingAuths.set(authToken, {
      email,
      authorized: false,
      timestamp: Date.now()
    });

    // Create authorization link
    const authLink = `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/authorize?token=${authToken}`;

    // Send email notification
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: 'ghajarmehrdad@gmail.com',
      subject: 'DiagnoVera Login Authorization Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4f46e5;">DiagnoVera Login Request</h2>
          <p>A user is attempting to login to DiagnoVera:</p>
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>IP Address:</strong> ${req.headers['x-forwarded-for'] || req.connection.remoteAddress}</p>
          </div>
          <p>Click the button below to authorize this login:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${authLink}" style="background: #4f46e5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Authorize Login
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">This link will expire in 10 minutes.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">If you did not expect this request, please ignore this email.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    // Clean up old pending auths (older than 10 minutes)
    for (const [token, data] of pendingAuths.entries()) {
      if (Date.now() - data.timestamp > 600000) {
        pendingAuths.delete(token);
      }
    }

    res.status(200).json({
      success: true,
      token: authToken,
      message: 'Authorization request sent. Please wait for approval.'
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// Export for use in other endpoints
export { pendingAuths };