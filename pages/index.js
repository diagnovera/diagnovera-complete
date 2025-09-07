// pages/index.js
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { status, email, token } = router.query;
  const [isLoading, setIsLoading] = useState(false);
  const [authStatus, setAuthStatus] = useState('');
  const [isApproved, setIsApproved] = useState(false);

  // Handle pending approval status
  useEffect(() => {
    if (status === 'pending' && email && token) {
      setAuthStatus('Your login request is pending admin approval...');
      
      // Check for approval periodically
      const checkApproval = async () => {
        try {
          const response = await fetch('/api/auth/check-approval', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, token })
          });

          const data = await response.json();
          
          if (data.approved) {
            // Store authorization
            localStorage.setItem('diagnovera_session', JSON.stringify({
              authorized: true,
              email: email,
              token: token,
              timestamp: new Date().toISOString()
            }));
            
            // Set auth cookie
            document.cookie = `authToken=${btoa(JSON.stringify({ 
              authorized: true, 
              email: email 
            }))}; path=/`;
            
            setIsApproved(true);
            setAuthStatus('Approved! Redirecting to application...');
            
            // Redirect to main app after a short delay
            setTimeout(() => {
              router.push('/diagnoveraenterpriseinterface');
            }, 1500);
          }
        } catch (error) {
          console.error('Error checking approval:', error);
        }
      };

      // Check immediately
      checkApproval();
      
      // Then check every 5 seconds if not approved
      if (!isApproved) {
        const interval = setInterval(checkApproval, 5000);
        return () => clearInterval(interval);
      }
    }

    // Check if already authorized
    const storedSession = localStorage.getItem('diagnovera_session');
    if (storedSession) {
      try {
        const sessionData = JSON.parse(storedSession);
        if (sessionData.authorized) {
          router.push('/diagnoveraenterpriseinterface');
        }
      } catch (e) {
        console.error('Error checking stored session:', e);
      }
    }
  }, [status, email, token, router, isApproved]);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setAuthStatus('Redirecting to Google...');
    
    // Your existing Google OAuth logic here
    // This should redirect to your OAuth endpoint
    window.location.href = '/api/auth/google';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-block bg-blue-600 rounded-xl p-4 mb-4">
            <h1 className="text-4xl font-black text-white">DVERA™</h1>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">DiagnoVera Enterprise</h2>
          <p className="text-gray-600">AI-Powered Clinical Decision Support</p>
        </div>

        <div className="space-y-4">
          {status === 'pending' ? (
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
              <p className="text-gray-600 mb-2">Signed in as:</p>
              <p className="font-medium text-gray-800 mb-4">{email}</p>
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  Awaiting admin approval...
                </p>
                <p className="text-xs text-yellow-600 mt-1">
                  You'll be automatically redirected once approved.
                </p>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-300 rounded-lg px-6 py-3 hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                <span className="font-medium text-gray-700">
                  {isLoading ? 'Signing in...' : 'Sign in with Google'}
                </span>
              </button>

              <p className="text-xs text-center text-gray-500">
                Your login request will be sent for admin approval
              </p>
            </>
          )}

          {authStatus && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800 text-center">{authStatus}</p>
            </div>
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-center text-gray-400">
            © 2024 DiagnoVera Enterprise. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}