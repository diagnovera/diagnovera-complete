// frontend/pages/index.js
import dynamic from 'next/dynamic'
import React, { useState, useEffect } from 'react'
import Head from 'next/head'

const HomePage = dynamic(
  () => import('../components/homepage'),
  { ssr: false }
)

export default function IndexPage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleAuthSuccess = (userData) => {
    console.log('Auth success:', userData);
    // FIXED: Redirect to your actual main application page
    window.location.href = '/diagnoveraenterpriseinterface';
  }

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    )
  }

  // ALWAYS show login page - no auth checks, no redirects
  return (
    <>
      <Head>
        <title>DiagnoVera Inc. - DVeraâ„¢ Renal AI</title>
        <meta name="description" content="Enterprise-grade Renal Subspecialty AI" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <HomePage onAuthSuccess={handleAuthSuccess} />
    </>
  );
}