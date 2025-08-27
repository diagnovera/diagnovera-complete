// pages/enterprise.js
import DiagnoVeraEnterpriseInterface from '../components/DiagnoVeraEnterpriseInterface';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function EnterprisePage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    // Check if user is authorized
    const authToken = localStorage.getItem('authToken') || 
                     document.cookie.split(';').find(row => row.startsWith('authToken='));
    
    if (!authToken) {
      router.push('/'); // Redirect to homepage if not authorized
      return;
    }
    
    setIsAuthorized(true);
  }, [router]);

  if (!isAuthorized) {
    return <div>Checking authorization...</div>;
  }

  return <DiagnoVeraEnterpriseInterface />;
}