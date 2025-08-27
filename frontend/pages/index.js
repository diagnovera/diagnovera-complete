// frontend/pages/index.js
import dynamic from 'next/dynamic'
import React, { useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'

// Import your actual homepage component
const HomePage = dynamic(
  () => import('../components/homepage'),
  { ssr: false }
)

export default function IndexPage() { // Changed from Home to IndexPage
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