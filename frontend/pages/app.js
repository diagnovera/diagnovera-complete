// frontend/pages/app.js
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';

const DiagnoVeraEnterpriseInterface = dynamic(
  () => import('../components/DiagnoVeraEnterpriseInterface'),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading DiagnoVera Enterprise Interface...</p>
        </div>
      </div>
    )
  }
);

export default function MainApp() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { authorized, email } = router.query;

    if (authorized === 'true' && email) {
      const sessionToken = btoa(JSON.stringify({
        email: email,
        authorizedAt: new Date().toISOString(),
        direct: true
      }));

      localStorage.setItem('authToken', sessionToken);
      localStorage.setItem('userEmail', email);
      document.cookie = `authToken=${sessionToken}; path=/; max-age=86400`;

      setIsAuthorized(true);
      setLoading(false);
      return;
    }

    const authToken = localStorage.getItem('authToken');
    const cookieAuth = document.cookie.includes('authToken=');

    if (authToken || cookieAuth) {
      setIsAuthorized(true);
    } else {
      router.push('/');
      return;
    }

    setLoading(false);
  }, [router, router.query]);

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
        </div>
      </div>
    );
  }

  return <DiagnoVeraEnterpriseInterface />;
}