// pages/index.js
import dynamic from 'next/dynamic'
import React, { useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'

// Import your actual homepage component
const HomePage = dynamic(
  () => import('../components/homepage'),
  { ssr: false }
)

export default function Home() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = () => {
      const authToken = localStorage.getItem('authToken');
      const userEmail = localStorage.getItem('userEmail');

      if (authToken && userEmail) {
        // REDIRECT instead of loading DiagnoVera here
        router.push('/app');
        return;
      }

      setLoading(false);
      setMounted(true);
    };

    checkAuth();
  }, [router]);

  const handleAuthSuccess = (userData) => {
    console.log('Auth success:', userData);
    // REDIRECT to app instead of changing state
    router.push('/app');
  }

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // ONLY show the homepage - no DiagnoVera interface mixed in
  return (
    <>
      <Head>
        <title>DiagnoVera Inc. - DVera™ Renal AI</title>
        <meta name="description" content="Enterprise-grade Renal Subspecialty AI" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <HomePage onAuthSuccess={handleAuthSuccess} />
    </>
  );
}

export default function Home() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check authentication status
    const checkAuth = () => {
      const authToken = localStorage.getItem('authToken');
      const userEmail = localStorage.getItem('userEmail');

      if (authToken && userEmail) {
        setIsAuthenticated(true);
      }
      setLoading(false);
      setMounted(true);
    };

    checkAuth();

    // Listen for storage changes (for cross-tab auth sync)
    window.addEventListener('storage', checkAuth);

    return () => {
      window.removeEventListener('storage', checkAuth);
    };
  }, []);

  const handleAuthSuccess = (userData) => {
    console.log('Auth success:', userData);
    setIsAuthenticated(true);
    // Force re-render
    setLoading(true);
    setTimeout(() => setLoading(false), 100);
  }

  const handleLogout = () => {
    localStorage.clear();
    document.cookie = 'authToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    setIsAuthenticated(false);
    window.location.href = '/';
  }

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Show DiagnoVera interface if authenticated
  if (isAuthenticated) {
    return (
      <>
        <Head>
          <title>DiagnoVera Enterprise - Clinical Decision Support System</title>
          <meta name="description" content="AI-powered clinical decision support system" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>

        {/* Logout button */}
        <div style={{
          position: 'fixed',
          top: 20,
          right: 20,
          zIndex: 9999,
          background: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <button
            onClick={handleLogout}
            style={{
              background: '#ef4444',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px'
            }}
          >
            Logout
          </button>
        </div>

        <DiagnoVeraEnterpriseInterface />
      </>
    );
  }

  // Show HomePage with authentication if not authenticated
  return (
    <>
      <Head>
        <title>DiagnoVera Inc. - DVera™ Renal AI</title>
        <meta name="description" content="Enterprise-grade Renal Subspecialty AI" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <HomePage onAuthSuccess={handleAuthSuccess} />
    </>
  );
}