// pages/api/auth/check-approval.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, token } = req.body;

  // TODO: Replace this with your actual approval logic
  // You could check a database, admin panel, or a simple list
  const approvedEmails = [
    // Add your email here to approve yourself
    'your-email@gmail.com',
  ];

  const approved = approvedEmails.includes(email);

  // You could also implement token validation here
  // For now, we're just checking the email

  res.status(200).json({ approved });
}