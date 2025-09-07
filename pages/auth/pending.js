// pages/auth/pending.js
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function AuthPending() {
  const router = useRouter();
  const { email, token } = router.query;

  useEffect(() => {
    if (email && token) {
      // Redirect to homepage with auth status
      router.push(`/?status=pending&email=${encodeURIComponent(email)}&token=${token}`);
    }
  }, [email, token, router]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p>Redirecting...</p>
    </div>
  );
}