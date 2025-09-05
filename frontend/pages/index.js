// frontend/pages/index.js
import dynamic from 'next/dynamic'
import React, { useState, useEffect } from 'react'
import Head from 'next/head'

// Load HomePage component with no SSR to prevent hydration issues
const HomePage = dynamic(
  () => import('../components/homepage'),
  { 
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading DiagnoVera...</p>
        </div>
      </div>
    )
  }
)

export default function IndexPage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleAuthSuccess = (userData) => {
    console.log('Auth success:', userData);
    // Redirect to your actual main application page
    if (typeof window !== 'undefined') {
      window.location.href = '/diagnoveraenterpriseinterface';
    }
  }

  // Prevent hydration issues by not rendering until mounted
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing...</p>
        </div>
      </div>
    )
  }

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