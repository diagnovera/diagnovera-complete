// pages/diagnoveraenterpriseinterface.js
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import the main component to prevent SSR issues
const DiagnoVeraInterface = dynamic(
  () => import('../components/DiagnoVeraEnterpriseInterface'),
  { 
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading DiagnoVera Enterprise Interface...</p>
        </div>
      </div>
    )
  }
);

export default function DiagnoVeraEnterprisePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    // Check for authorization
    const checkAuth = async () => {
      // Check localStorage
      const storedSession = localStorage.getItem('diagnovera_session');
      if (storedSession) {
        try {
          const sessionData = JSON.parse(storedSession);
          if (sessionData.authorized) {
            setAuthorized(true);
            return;
          }
        } catch (e) {
          console.error('Error parsing stored session:', e);
        }
      }

      // Check cookies
      const authToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('authToken='))
        ?.split('=')[1];

      if (authToken) {
        try {
          const tokenData = JSON.parse(atob(authToken));
          if (tokenData.authorized) {
            setAuthorized(true);
            return;
          }
        } catch (e) {
          console.error('Error parsing auth token:', e);
        }
      }

      // Redirect if no auth
      if (status !== 'loading' && !session && !authorized) {
        console.log('No authorization found, redirecting to login');
        router.push('/');
      }
    };

    checkAuth();
  }, [session, status, router, authorized]);

  // Show loading while checking auth
  if (status === 'loading' || (!authorized && !session)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying authorization...</p>
        </div>
      </div>
    );
  }

  // User is authorized, show the interface
  return <DiagnoVeraInterface session={session} />;
}