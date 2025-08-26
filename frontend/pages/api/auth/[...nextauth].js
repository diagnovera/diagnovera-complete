// pages/api/auth/[...nextauth].js
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';

// Email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD
  }
});

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Only allow Gmail accounts
      if (!user.email || !user.email.endsWith('@gmail.com')) {
        return false;
      }

      try {
        // Generate authorization token with ALL user data
        const authToken = jwt.sign(
          {
            email: user.email,
            name: user.name,
            image: user.image,
            timestamp: Date.now()
          },
          process.env.JWT_SECRET,
          { expiresIn: '10m' }
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
                <p><strong>Name:</strong> ${user.name || 'N/A'}</p>
                <p><strong>Email:</strong> ${user.email}</p>
                <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                ${user.image ? `<img src="${user.image}" alt="${user.name}" style="width: 50px; height: 50px; border-radius: 50%; margin-top: 10px;">` : ''}
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
        });

        // Return false to prevent immediate sign in
        return false;
      } catch (error) {
        console.error('Auth error:', error);
        return false;
      }
    },
  },
  pages: {
    signIn: '/',
    error: '/?status=error'
  },
  secret: process.env.NEXTAUTH_SECRET
};

export default NextAuth(authOptions);