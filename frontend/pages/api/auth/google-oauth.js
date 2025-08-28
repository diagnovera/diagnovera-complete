// pages/api/auth/google-oauth.js
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  console.log('Google OAuth API called:', req.method);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { credential } = req.body;
  console.log('Credential received:', credential ? 'Yes' : 'No');

  if (!credential) {
    return res.status(400).json({ error: 'No credential provided' });
  }

  try {
    // Check environment variables
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET not set');
      return res.status(500).json({ error: 'Server configuration error - JWT_SECRET' });
    }

    if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
      console.error('Email credentials not set');
      return res.status(500).json({ error: 'Server configuration error - Email' });
    }

    // Decode the Google JWT (without verification for demo)
    const decoded = jwt.decode(credential);
    console.log('Decoded JWT:', decoded ? 'Success' : 'Failed');
    
    if (!decoded || !decoded.email) {
      return res.status(400).json({ error: 'Invalid credential - cannot decode' });
    }

    const { email, name, picture } = decoded;
    console.log('User email:', email);

    // Only allow Gmail accounts
    if (!email.endsWith('@gmail.com')) {
      return res.status(400).json({ 
        error: 'Only Gmail accounts allowed',
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

    // FIXED: Create proper authorization link with correct base URL
    // Get the base URL from environment or construct it
    let baseUrl;
    if (process.env.NEXTAUTH_URL) {
      baseUrl = process.env.NEXTAUTH_URL;
    } else if (process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`;
    } else {
      baseUrl = 'http://localhost:3000';
    }

    // Ensure the token is properly URL encoded
    const encodedToken = encodeURIComponent(authToken);
    const authLink = `${baseUrl}/api/auth/authorize?token=${encodedToken}`;
    
    console.log('Generated auth link:', authLink);
    console.log('Token length:', authToken.length);

    // Create email transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
      }
    });

    // Send email notification to admin
    const emailResult = await transporter.sendMail({
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
          <div style="margin-top: 30px; padding: 10px; background: #f9f9f9; border-radius: 4px; font-size: 12px; color: #666;">
            <p><strong>Debug Info:</strong></p>
            <p>Base URL: ${baseUrl}</p>
            <p>Token length: ${authToken.length} characters</p>
            <p>Full link: ${authLink}</p>
          </div>
        </div>
      `
    });

    console.log('Email sent result:', emailResult.messageId);
    console.log(`Admin email sent successfully for user: ${email}`);

    return res.status(200).json({
      success: true,
      email: email,
      name: name,
      message: 'Authorization request sent to admin',
      debug: {
        authLinkGenerated: true,
        tokenLength: authToken.length,
        baseUrl: baseUrl
      }
    });

  } catch (error) {
    console.error('Google OAuth error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      details: 'Check server logs for more information'
    });
  }
}