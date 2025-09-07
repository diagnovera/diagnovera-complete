// pages/index.js
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Script from 'next/script';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { status, email, token } = router.query;
  const [isLoading, setIsLoading] = useState(false);
  const [authStatus, setAuthStatus] = useState('');
  const [isApproved, setIsApproved] = useState(false);
  const [googleLoaded, setGoogleLoaded] = useState(false);
  const [awaitingAuth, setAwaitingAuth] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const pollIntervalRef = React.useRef(null);

  // Initialize Google Sign-In
  const initializeGoogleSignIn = () => {
    if (!window.google || !googleLoaded) return;
    
    try {
      window.google.accounts.id.initialize({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      window.google.accounts.id.renderButton(
        document.getElementById("googleSignInButton"),
        {
          theme: "outline",
          size: "large",
          width: "100%",
          text: "signin_with",
          shape: "rectangular",
        }
      );
      console.log('Google Sign-In initialized');
    } catch (error) {
      console.error('Error initializing Google Sign-In:', error);
      setAuthStatus('Failed to initialize Google Sign-In');
    }
  };

  // Handle Google Sign-In response
  const handleGoogleResponse = async (response) => {
    console.log('Google sign-in response received');
    setIsLoading(true);
    setAuthStatus('Processing sign-in...');
    
    try {
      // Decode to get email for display
      const payload = JSON.parse(atob(response.credential.split('.')[1]));
      setAuthEmail(payload.email);

      // Send to your custom OAuth handler
      const result = await fetch('/api/auth/google-oauth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credential: response.credential
        })
      });

      const data = await result.json();

      if (!result.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      // Start waiting for approval
      setAwaitingAuth(true);
      setAuthStatus('Authorization request sent. Check admin email for approval link.');
      
      // Start polling for authorization
      pollForAuthorization(payload.email);
      
    } catch (error) {
      console.error('Authentication error:', error);
      setAuthStatus(`Error: ${error.message}`);
      setIsLoading(false);
    }
  };

  // Poll for authorization status
  const pollForAuthorization = (email) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    let attempts = 0;
    const maxAttempts = 120; // 10 minutes

    pollIntervalRef.current = setInterval(async () => {
      attempts++;
      
      try {
        const response = await fetch('/api/auth/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });

        const data = await response.json();
        
        if (data.authorized) {
          clearInterval(pollIntervalRef.current);
          
          // Store session
          localStorage.setItem('diagnovera_session', JSON.stringify({
            authorized: true,
            email: data.user.email,
            name: data.user.name,
            image: data.user.image,
            timestamp: new Date().toISOString()
          }));
          
          // Set auth cookie
          document.cookie = `authToken=${data.sessionToken}; path=/; max-age=86400`;
          
          setAuthStatus('Approved! Redirecting...');
          setIsApproved(true);
          
          setTimeout(() => {
            router.push('/diagnoveraenterpriseinterface');
          }, 1500);
        }
      } catch (error) {
        console.error('Poll error:', error);
      }

      if (attempts >= maxAttempts) {
        clearInterval(pollIntervalRef.current);
        setAwaitingAuth(false);
        setAuthStatus('Authorization timeout. Please try again.');
      }
    }, 5000); // Poll every 5 seconds
  };

  // Check existing session
  useEffect(() => {
    const storedSession = localStorage.getItem('diagnovera_session');
    if (storedSession) {
      try {
        const sessionData = JSON.parse(storedSession);
        if (sessionData.authorized) {
          router.push('/diagnoveraenterpriseinterface');
        }
      } catch (e) {
        console.error('Error checking stored session:', e);
        localStorage.removeItem('diagnovera_session');
      }
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [router]);

  // Initialize Google on script load
  useEffect(() => {
    if (googleLoaded) {
      initializeGoogleSignIn();
    }
  }, [googleLoaded]);

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => {
          setGoogleLoaded(true);
        }}
      />
      
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
            {awaitingAuth ? (
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
                <p className="text-gray-600 mb-2">Signed in as:</p>
                <p className="font-medium text-gray-800 mb-4">{authEmail}</p>
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    Awaiting admin approval...
                  </p>
                  <p className="text-xs text-yellow-600 mt-1">
                    Admin should check email for authorization link.
                    You'll be automatically redirected once approved.
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (pollIntervalRef.current) {
                      clearInterval(pollIntervalRef.current);
                    }
                    setAwaitingAuth(false);
                    setAuthEmail('');
                    setAuthStatus('');
                  }}
                  className="mt-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <div id="googleSignInButton" className="w-full">
                  {!googleLoaded && (
                    <div className="flex items-center justify-center gap-3 bg-white border-2 border-gray-300 rounded-lg px-6 py-3">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="font-medium text-gray-700">Loading...</span>
                    </div>
                  )}
                </div>

                <p className="text-xs text-center text-gray-500">
                  Your login request will be sent for admin approval
                </p>
              </>
            )}

            {authStatus && !awaitingAuth && (
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
    </>
  );
}