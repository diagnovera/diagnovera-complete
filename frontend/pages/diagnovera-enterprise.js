// pages/diagnovera-enterprise.js
import DiagnoVeraEnterpriseInterface from '../components/DiagnoVeraEnterpriseInterface';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function DiagnoVeraEnterprisePage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is authorized
    const authToken = localStorage.getItem('authToken');
    const cookieToken = document.cookie.split(';').find(row => row.startsWith('authToken='));
    
    if (!authToken && !cookieToken) {
      console.log('No auth token found, redirecting to homepage');
      router.push('/');
      return;
    }
    
    console.log('User authorized, loading DiagnoVera Enterprise Interface');
    setIsAuthorized(true);
    setLoading(false);
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading DiagnoVera Enterprise Interface...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-lg">Authorization required</p>
          <button 
            onClick={() => router.push('/')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return <DiagnoVeraEnterpriseInterface />;
}