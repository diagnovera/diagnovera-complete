import dynamic from 'next/dynamic'
import React, { useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import Script from 'next/script'
import axios from 'axios'

// Dynamically import the HomePage component
const HomePage = dynamic(
  () => import('../components/HomePage').catch(err => {
    console.error('Failed to load HomePage:', err);
    // If HomePage doesn't exist, return a simple login UI
    return () => (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
          <h1 className="text-2xl font-bold mb-4">DiagnoVera</h1>
          <p className="text-gray-600 mb-6">Clinical Decision Support System</p>
          <button 
            onClick={() => window.location.href = '/dashboard'}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Continue to Dashboard
          </button>
        </div>
      </div>
    );
  }),
  { ssr: false }
)

// Dynamically import DiagnoVera interface
const DiagnoVeraEnterpriseInterface = dynamic(
  () => import('../components/DiagnoVeraEnterpriseInterface').catch(err => {
    console.error('Failed to load component:', err);
    return () => (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl w-full">
          <h2 className="text-xl font-bold text-red-600 mb-4">Component Load Error</h2>
          <p className="text-gray-700 mb-4">Failed to load DiagnoVera component.</p>
          <details className="mb-4">
            <summary className="cursor-pointer text-blue-600 hover:underline">Error Details</summary>
            <pre className="mt-2 p-4 bg-gray-100 rounded text-xs overflow-auto">
              {err.message}
              {err.stack}
            </pre>
          </details>
          <p className="text-sm text-gray-600">
            Please check that the component file exists at: 
            <code className="bg-gray-200 px-2 py-1 rounded text-xs">
              components/DiagnoVeraEnterpriseInterface.js
            </code>
          </p>
        </div>
      </div>
    );
  }),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading DiagnoVera Enterprise...</p>
          <p className="text-xs text-gray-500 mt-4">Initializing clinical decision support system</p>
        </div>
      </div>
    )
  }
)

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl w-full">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Application Error</h1>
            <p className="text-gray-700 mb-4">Something went wrong while loading DiagnoVera.</p>
            
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
              <h3 className="font-semibold text-yellow-800 mb-2">Common Issues:</h3>
              <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
                <li>Missing component file in components folder</li>
                <li>D3.js not installed properly</li>
                <li>Environment variables not set</li>
              </ul>
            </div>

            <details className="mb-4">
              <summary className="cursor-pointer text-blue-600 hover:underline">Error Details</summary>
              <pre className="mt-2 p-4 bg-gray-100 rounded text-xs overflow-auto">
                {this.state.error?.toString()}
                {this.state.error?.stack}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
            
            <div className="space-y-2">
              <button
                onClick={() => window.location.reload()}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
              >
                Reload Page
              </button>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null, errorInfo: null });
                }}
                className="w-full px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function Home() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [showHomePage, setShowHomePage] = useState(true)
  const [envCheck, setEnvCheck] = useState({
    backendUrl: null,
    n8nUrl: null
  })

  useEffect(() => {
    console.log('Home page mounted');
    
    // Check authentication status
    const authToken = localStorage.getItem('authToken');
    if (authToken) {
      setIsAuthenticated(true);
      setShowHomePage(false);
    }
    
    // Check environment variables
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.REACT_APP_BACKEND_URL;
    const n8nUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL || process.env.REACT_APP_N8N_WEBHOOK_URL;
    
    console.log('Backend URL:', backendUrl);
    console.log('n8n URL:', n8nUrl);
    
    setEnvCheck({
      backendUrl: backendUrl || 'Not set - using default',
      n8nUrl: n8nUrl || 'Not set - using default'
    });
    
    // Check if running in development
    if (process.env.NODE_ENV === 'development' && (!backendUrl || !n8nUrl)) {
      console.warn('⚠️ Environment variables not set. Create a .env.local file with:');
      console.warn('NEXT_PUBLIC_BACKEND_URL=http://localhost:5000');
      console.warn('NEXT_PUBLIC_N8N_WEBHOOK_URL=https://your-n8n-url.com/webhook/medical-diagnosis');
    }
    
    setMounted(true);
  }, [])

  // Handle authentication callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    
    if (status === 'authenticated') {
      setIsAuthenticated(true);
      setShowHomePage(false);
      // Clean up URL
      window.history.replaceState({}, document.title, '/');
    }
  }, []);

  const handleAuthSuccess = (token) => {
    localStorage.setItem('authToken', token);
    setIsAuthenticated(true);
    setShowHomePage(false);
  }

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    document.cookie = 'authToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    setIsAuthenticated(false);
    setShowHomePage(true);
  }

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing...</p>
        </div>
      </div>
    )
  }

  // Show HomePage with authentication if not authenticated
  if (showHomePage && !isAuthenticated) {
    return (
      <>
        <Head>
          <title>DiagnoVera Inc. - DVera™ Renal AI</title>
          <meta name="description" content="Enterprise-grade Renal Subspecialty AI – dialysis analytics, CKD management, interoperability, security." />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon.ico" />
        </Head>
        <HomePage onAuthSuccess={handleAuthSuccess} />
      </>
    );
  }

  // Show DiagnoVera interface if authenticated
  return (
    <>
      <Head>
        <title>DiagnoVera Enterprise - Clinical Decision Support System</title>
        <meta name="description" content="AI-powered clinical decision support system with complex plane analysis" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <ErrorBoundary>
        {/* Logout button */}
        <div style={{
          position: 'fixed',
          top: 0,
          right: 0,
          padding: '10px 20px',
          background: '#fff',
          borderBottom: '1px solid #e5e7eb',
          borderLeft: '1px solid #e5e7eb',
          borderRadius: '0 0 0 12px',
          zIndex: 1000
        }}>
          <button
            onClick={handleLogout}
            style={{
              background: '#ef4444',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Logout
          </button>
        </div>
        
        <DiagnoVeraEnterpriseInterface />
        
        {/* Development Environment Info */}
        {process.env.NODE_ENV === 'development' && (
          <div className="fixed bottom-4 right-4 p-3 bg-gray-800 text-white text-xs rounded shadow-lg max-w-sm">
            <div className="font-semibold mb-1">Dev Environment</div>
            <div>Backend: {envCheck.backendUrl}</div>
            <div>n8n: {envCheck.n8nUrl}</div>
            <div>Auth: {isAuthenticated ? 'Authenticated' : 'Not authenticated'}</div>
          </div>
        )}
      </ErrorBoundary>
    </>
  )
}