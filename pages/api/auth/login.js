// pages/api/auth/login.js
import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';

// Configure email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD
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

    // Generate authorization token with user data
    const authToken = jwt.sign(
      {
        email,
        name: null, // No name for email/password login
        image: null,
        timestamp: Date.now()
      },
      process.env.JWT_SECRET,
      { expiresIn: '10m' }
    );

    // Create authorization link
    const authLink = `${process.env.NEXTAUTH_URL}/api/auth/authorize?token=${authToken}`;

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