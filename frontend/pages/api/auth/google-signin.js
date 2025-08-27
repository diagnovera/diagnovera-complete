import { OAuth2Client } from 'google-auth-library';
import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Email transporter
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

  const { credential } = req.body;

  try {
    // Verify the Google token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const { email, name, picture } = payload;

    // Only allow Gmail accounts
    if (!email || !email.endsWith('@gmail.com')) {
      return res.status(403).json({ message: 'Only Gmail accounts are allowed' });
    }

    // Generate authorization token with ALL user data
// Find this section and update the JWT creation:
const authToken = jwt.sign(
  {
    email,
    name,
    image: picture,
    timestamp: Date.now(),
    iat: Math.floor(Date.now() / 1000)
  },
  process.env.JWT_SECRET,
  { expiresIn: '30m' } // Increase from 10m to 30m
);

    // Create authorization link
    const authLink = `${process.env.NEXTAUTH_URL}/api/auth/authorize?token=${authToken}`;

    // Send email notification
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: 'ghajarmehrdad@gmail.com',
      subject: 'DiagnoVera Login Authorization Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4f46e5;">DiagnoVera Login Request</h2>
          <p>A Gmail user is attempting to login to DiagnoVera:</p>
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

    res.status(200).json({
      success: true,
      token: authToken,
      email,
      message: 'Authorization request sent. Please wait for approval.'
    });

  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ message: 'Authentication failed' });
  }
}