// pages/api/alerts.js (Pages Router)
export default async function handler(req, res) {
  if (req.method === 'POST') {
    const alert = req.body;
    console.log('Critical Alert:', alert);
    
    // Send email, save to database, etc.
    
    res.status(200).json({ received: true });
  }
}

// OR app/api/alerts/route.js (App Router)
export async function POST(request) {
  const alert = await request.json();
  console.log('Critical Alert:', alert);
  
  return Response.json({ received: true });
}