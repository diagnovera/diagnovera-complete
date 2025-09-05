// components/HomePage.js
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { signIn } from 'next-auth/react';
import Script from 'next/script';

export default function HomePage({ onAuthSuccess }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [awaitingAuth, setAwaitingAuth] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [userMessage, setUserMessage] = useState('');
  const pollIntervalRef = useRef(null);

// Update the useEffect in your homepage that checks for existing sessions:

useEffect(() => {
  // Check for existing session on mount
  const sessionData = localStorage.getItem('diagnovera_session');
  if (sessionData) {
    try {
      const session = JSON.parse(sessionData);
      if (session.authorized && session.email) {
        console.log('Found existing session for:', session.email);
        
        // CRITICAL: Create JWT cookie that middleware expects
        const sessionToken = btoa(JSON.stringify({
          email: session.email,
          name: session.name,
          image: session.image,
          authorized: true,
          authorizedAt: session.timestamp || Date.now()
        }));
        
        // Set the cookie that middleware checks for
        document.cookie = `authToken=${sessionToken}; path=/; max-age=86400; samesite=strict`;
        
        console.log('Set auth cookie, redirecting...');
        
        // Small delay to ensure cookie is set
        setTimeout(() => {
          if (onAuthSuccess) {
            onAuthSuccess(session);
          } else {
            window.location.href = '/diagnoveraenterpriseinterface';
          }
        }, 100);
        return;
      }
    } catch (error) {
      console.error('Error parsing session data:', error);
      localStorage.removeItem('diagnovera_session');
    }
  }

  // Initialize Google Sign-In when script loads
  if (window.google) {
    initializeGoogleSignIn();
  }

  // Cleanup function to clear polling on unmount
  return () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
  };
}, [onAuthSuccess]);

  const initializeGoogleSignIn = () => {
    if (!window.google || !document.getElementById("googleSignInButton")) {
      return;
    }

    window.google.accounts.id.initialize({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      callback: handleGoogleResponse
    });

    window.google.accounts.id.renderButton(
      document.getElementById("googleSignInButton"),
      {
        theme: "outline",
        size: "large",
        width: "300",  // Changed from "100%" to a pixel value
        text: "signin_with",
        shape: "rectangular",
        logo_alignment: "center"
      }
    );
  };

  const pollAuthorization = async (email) => {
    // Clear any existing polling
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    if (!email || email.trim() === '') {
      console.error('Cannot poll with empty email');
      setAwaitingAuth(false);
      setError('Email validation failed. Please try again.');
      return;
    }

    let attempts = 0;
    const maxAttempts = 200; // 10 minutes at 3-second intervals

    console.log('Starting authorization polling for:', email);
    setUserMessage(`Waiting for admin approval for ${email}...`);

    pollIntervalRef.current = setInterval(async () => {
      attempts++;
      console.log(`Poll attempt ${attempts} for ${email}`);

      try {
        // Poll your Upstash Redis-based status API
        const response = await fetch('/api/auth/status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: email })
        });

        if (!response.ok) {
          if (response.status === 401) {
            // Still waiting for authorization - this is expected
            const minutesWaited = Math.floor(attempts * 3 / 60);
            setUserMessage(`Still waiting for admin approval... (${minutesWaited} min${minutesWaited !== 1 ? 's' : ''})`);
            return;
          }
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.authorized) {
          console.log('Authorization confirmed for:', email);
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setAwaitingAuth(false);
          setUserMessage('Authorization approved! Redirecting...');

          // Store session data
          localStorage.setItem('diagnovera_session', JSON.stringify({
            email: data.user.email,
            name: data.user.name,
            image: data.user.image,
            authorized: true,
            timestamp: Date.now()
          }));

          // Set cookie for server-side checks
          document.cookie = `authToken=${data.sessionToken}; path=/; max-age=86400; samesite=strict`;

          // Small delay to show the message, then redirect
          setTimeout(() => {
            if (onAuthSuccess) {
              onAuthSuccess(data.user);
            } else {
              window.location.href = '/diagnoveraenterpriseinterface';
            }
          }, 1500);
          return;
        }

      } catch (err) {
        console.log(`Poll attempt ${attempts} - error:`, err.message);
        
        // Continue polling for common errors
        if (attempts < 10 || err.message.includes('401') || err.message.includes('Not authorized')) {
          const minutesWaited = Math.floor(attempts * 3 / 60);
          setUserMessage(`Still waiting for admin approval... (${minutesWaited} min${minutesWaited !== 1 ? 's' : ''})`);
          return;
        }
        
        // Stop on persistent errors
        console.error('Stopping polling due to error:', err);
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
        setAwaitingAuth(false);
        setError('Authorization check failed. Please try logging in again.');
        return;
      }

      // Stop after max attempts (10 minutes)
      if (attempts >= maxAttempts) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
        setAwaitingAuth(false);
        setError('Authorization timeout after 10 minutes. Please contact the administrator.');
      }
    }, 3000); // Poll every 3 seconds
  };

const handleGoogleResponse = async (response) => {
  try {
    setError('');
    setUserMessage('Processing sign-in...');
    
    // Decode the Google JWT to get basic user info for display
    const payload = JSON.parse(atob(response.credential.split('.')[1]));
    const userEmail = payload.email;
    const userName = payload.name;

    console.log('Google sign-in successful for:', userEmail);

    // Only allow Gmail accounts
    if (!userEmail.endsWith('@gmail.com')) {
      setError('Only Gmail accounts are allowed. Please use a Gmail account.');
      setUserMessage('');
      return;
    }

    // Store user info temporarily
    setAuthEmail(userEmail);
    setUserMessage(`Processing sign-in for ${userName}...`);

    // Send to our direct OAuth API instead of NextAuth
    const result = await fetch('/api/auth/google-oauth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        credential: response.credential
      })
    });

    console.log('API Response status:', result.status);
    
    // Get response as text first to handle both JSON and HTML responses
    const responseText = await result.text();
    console.log('API Response text:', responseText);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse response as JSON:', parseError);
      console.log('Raw response:', responseText);
      throw new Error('Server returned invalid response: ' + responseText.substring(0, 100));
    }

    if (!result.ok) {
      throw new Error(data.message || data.error || 'Sign-in failed');
    }

    console.log('OAuth API response:', data);

    // Start the authorization flow
    setAwaitingAuth(true);
    setUserMessage(`Admin notification sent for ${userName}. Waiting for approval...`);

    // Start polling your Upstash Redis-based authorization status
    pollAuthorization(userEmail);

  } catch (err) {
    console.error('Google signin error:', err);
    setError('Authentication failed: ' + err.message);
    setUserMessage('');
    setAwaitingAuth(false);
  }
};

  // Function to cancel the authorization process
  const cancelAuthorization = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setAwaitingAuth(false);
    setAuthEmail('');
    setUserMessage('');
    setError('');
  };

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => {
          if (window.google) {
            initializeGoogleSignIn();
          }
        }}
      />
      <style jsx>{`
        :root{
          --indigo:#4f46e5;--fuchsia:#9333ea;--sky:#0ea5e9;--green:#10b981;--amber:#f59e0b;--red:#ef4444;
          --text:#0b1020;--muted:#475569;--soft:#f8fafc;--border:#e5e7eb;--bg:#ffffff;
        }
        *{box-sizing:border-box}
        html,body{margin:0;padding:0}
        body{font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#fff;color:var(--text);line-height:1.6}
        header{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.9);backdrop-filter:saturate(140%) blur(8px);border-bottom:1px solid var(--border)}
        .container{max-width:1200px;margin:0 auto;padding:0 24px}
        .nav{display:flex;align-items:center;justify-content:space-between;padding:14px 0}
        .brand{display:flex;align-items:center;gap:.75rem;text-decoration:none;color:inherit}
        .logo{width:40px;height:40px;border-radius:12px;background:conic-gradient(from 45deg,var(--indigo),var(--fuchsia),var(--sky),var(--indigo));box-shadow:0 8px 18px -10px rgba(79,70,229,.6)}
        .badge{font-size:.72rem;color:#64748b;text-transform:uppercase;letter-spacing:.12em}
        nav a{font-weight:600;color:#334155;margin-left:18px;text-decoration:none}
        nav a:hover{color:#0f172a}
        .hero{padding:48px 0 8px;position:relative;overflow:hidden}
        .grad{background:linear-gradient(90deg,var(--indigo),var(--fuchsia),var(--sky));-webkit-background-clip:text;background-clip:text;color:transparent;background-size:200% 200%;animation:shift 6s ease infinite}
        @keyframes shift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
        h1{font-size:clamp(2rem,4.2vw,3.4rem);line-height:1.1;margin:.25rem 0}
        .tabs{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}
        .tab{border:1px solid var(--border);border-radius:999px;padding:.5rem .9rem;cursor:pointer;background:#fff;color:#334155;font-weight:700}
        .tab.active{background:linear-gradient(135deg,var(--indigo),var(--fuchsia));color:#fff;border-color:transparent}
        .tab-panel{display:none;margin-top:10px;color:var(--muted);max-width:850px}
        .tab-panel.active{display:block;animation:fade .35s ease}
        @keyframes fade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        .two{display:grid;grid-template-columns:1.2fr .8fr;gap:28px}
        @media(max-width:920px){.two{grid-template-columns:1fr}}
        section{padding:56px 0;border-top:1px solid var(--border)}
        h2{font-size:clamp(1.6rem,2.6vw,2.2rem);margin:0 0 8px}
        .grid{display:grid;gap:18px}
        .cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}
        @media(max-width:820px){.cols-3{grid-template-columns:1fr}}
        .card{border:1px solid var(--border);border-radius:18px;padding:18px;background:#fff;box-shadow:0 10px 28px -20px rgba(0,0,0,.25);transition:transform .25s ease,box-shadow .25s ease}
        .card:hover{transform:translateY(-2px);box-shadow:0 16px 36px -18px rgba(0,0,0,.32)}
        .login{max-width:460px;border:1px solid var(--border);border-radius:18px;padding:24px;background:#fff;box-shadow:0 14px 30px -18px rgba(0,0,0,.25)}
        .btn{display:inline-flex;align-items:center;justify-content:center;gap:.6rem;padding:.9rem 1.1rem;border-radius:14px;border:1px solid transparent;font-weight:800;cursor:pointer;transition:all .2s ease}
        .btn.google{background:#fff;border:2px solid var(--border);color:#1f2937;width:100%;font-size:1rem}
        .btn.google:hover{background:#f9fafb;transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,0,0,.1)}
        .google-icon{width:20px;height:20px}
        .error{color:#ef4444;font-size:.85rem;margin-top:12px;padding:10px;background:#fef2f2;border-radius:8px;border:1px solid #fee2e2}
        .success{color:#10b981;font-size:.85rem;margin-top:12px;padding:10px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0}
        .waiting{background:#f3f4f6;border-radius:12px;padding:20px;margin-top:12px;text-align:center}
        .waiting h4{margin:0 0 12px;color:#1f2937}
        .spinner{border:3px solid #f3f4f6;border-top:3px solid var(--indigo);border-radius:50%;width:40px;height:40px;animation:spin 1s linear infinite;margin:0 auto 16px}
        @keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
        .auth-info{background:#e0e7ff;border:1px solid #c7d2fe;border-radius:8px;padding:12px;margin-top:12px}
        .auth-info p{margin:4px 0;font-size:.9rem;color:#4c1d95}
        .cancel-btn{background:#6b7280;color:white;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;margin-top:12px;font-size:.85rem}
        .cancel-btn:hover{background:#4b5563}
        footer{background:var(--soft);border-top:1px solid var(--border);padding:22px 0;color:#64748b}
        .founder-wrap{max-width:1000px;margin:0 auto}
        .f-tabs{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0 0}
        .f-tab{border:1px solid var(--border);border-radius:999px;padding:.5rem .9rem;cursor:pointer;background:#fff;color:#334155;font-weight:700}
        .f-tab.active{background:linear-gradient(135deg,var(--indigo),var(--fuchsia));color:#fff;border-color:transparent}
        .f-panel{display:none;margin-top:14px}
        .f-panel.active{display:block;animation:fade .3s ease}
        .bullet{display:flex;align-items:flex-start;gap:10px;margin:8px 0}
        .dot{width:10px;height:10px;border-radius:999px;background:var(--indigo);margin-top:7px}
        .accord{border:1px solid var(--border);border-radius:14px;overflow:hidden;margin-top:10px}
        .accord button{width:100%;text-align:left;padding:12px 14px;border:0;background:#fff;font-weight:700;cursor:pointer}
        .accord .content{display:none;border-top:1px solid var(--border);padding:12px 14px;background:#fafafa}
        .accord.open .content{display:block}
        .divider{display:flex;align-items:center;gap:12px;margin:20px 0;color:#9ca3af;font-size:.875rem}
        .divider::before,.divider::after{content:'';flex:1;height:1px;background:var(--border)}
        .requirement{display:flex;align-items:center;gap:8px;padding:12px;background:#fef3c7;border:1px solid #fde68a;border-radius:8px;margin-bottom:16px}
        .requirement svg{width:20px;height:20px;color:#d97706}
        .requirement p{margin:0;font-size:.9rem;color:#92400e}
        .wf{position:relative;height:220px;margin:24px 0}
        .wf-rail{stroke:#e5e7eb;stroke-width:2;fill:none}
        .wf-trace{stroke:url(#g);stroke-width:3;fill:none;stroke-dasharray:1000;stroke-dashoffset:1000;animation:trace 3s ease forwards}
        @keyframes trace{to{stroke-dashoffset:0}}
        .wf-step{position:absolute;transform:translate(-50%,-50%);text-align:center}
        .wf-step .dot{width:16px;height:16px;background:var(--indigo);border-radius:50%;margin:0 auto 8px}
      `}</style>

      <header>
        <div className="container nav">
          <a className="brand" href="#">
            <div className="logo" aria-hidden="true"></div>
            <div>
              <div style={{fontWeight:800}}>Diagnovera Inc.</div>
              <div className="badge">DVeraâ„¢ AI OS</div>
            </div>
          </a>
          <nav>
            <a href="#platform">Platform</a>
            <a href="#renal">Renal AI</a>
            <a href="#workflow">Workflow</a>
            <a href="#security">Security</a>
            <a href="#enterprise">Enterprise</a>
            <a href="#founder">Founder</a>
            <a href="#contact">Contact</a>
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="container two">
          <div>
            <h1>DVeraâ„¢: <span className="grad">Renal Subspecialty AI</span> â€“ Dialysis Analytics & CKD Management</h1>
            <div className="tabs" role="tablist" aria-label="Focus areas">
              <button className="tab active" role="tab" onClick={(e) => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
                e.target.classList.add('active');
                document.getElementById('tab1').classList.add('active');
              }}>Renal Analytics</button>
              <button className="tab" role="tab" onClick={(e) => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
                e.target.classList.add('active');
                document.getElementById('tab2').classList.add('active');
              }}>Dialysis Quality</button>
              <button className="tab" role="tab" onClick={(e) => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
                e.target.classList.add('active');
                document.getElementById('tab3').classList.add('active');
              }}>CKD Management</button>
            </div>
            <p id="tab1" className="tab-panel active">
              Multidimensional modeling fuses labs, imaging, vitals, and clinical notes to produce explainable differentials, probability curves, and sensitivity analyses for nephrology workflows.
            </p>
            <p id="tab2" className="tab-panel">
              Dialysis adequacy (Kt/V), access complication surveillance, trend break detection, and hospitalization reduction insights with configurable thresholds and alerts.
            </p>
            <p id="tab3" className="tab-panel">
              CKD progression analytics with eGFR trajectory modeling, albuminuria trend tracking, intervention timing, and high-risk patient stratification.
            </p>
          </div>

          <div id="login">
            <div className="login">
              <h3 style={{margin:'0 0 8px'}}>DVeraâ„¢ Suite Access</h3>

              {awaitingAuth ? (
                <div className="waiting">
                  <div className="spinner"></div>
                  <h4>Awaiting Authorization</h4>
                  <p style={{color:'#64748b',fontSize:'.9rem'}}>
                    {userMessage}
                  </p>
                  <div className="auth-info">
                    <p><strong>Gmail Account:</strong> {authEmail}</p>
                    <p>An admin notification has been sent. Please wait for approval.</p>
                  </div>
                  <button 
                    className="cancel-btn" 
                    onClick={cancelAuthorization}
                    type="button"
                  >
                    Cancel Authorization
                  </button>
                </div>
              ) : (
                <>
                  <div className="requirement">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p>Gmail account required for access</p>
                  </div>

                  <div id="googleSignInButton" style={{marginTop: '10px'}}></div>

                  <div className="divider">or</div>

                  <p style={{textAlign:'center',fontSize:'.85rem',color:'#6b7280',margin:0}}>
                    Enterprise SSO options available after initial authentication
                  </p>

                  {error && <div className="error">{error}</div>}
                  {userMessage && !error && <div className="success">{userMessage}</div>}

                  <p style={{fontSize:'.8rem',color:'#64748b',margin:'16px 0 0'}}>
                    By continuing, you agree to role-based access controls and audit logging.
                    Access requires administrator approval.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Rest of the page content remains the same */}
      <section id="platform">
        <div className="container">
          <div className="badge" style={{color:'#4f46e5'}}>Platform</div>
          <h2>Explainable clinical AI with interoperable foundations</h2>
          <div className="grid cols-3" style={{marginTop:'16px'}}>
            <div className="card">
              <h3>Automated Diagnostics</h3>
              <p style={{color:'#64748b'}}>Evidence fusion across labs, vitals, imaging, and notes; probability curves and rationale narratives.</p>
            </div>
            <div className="card">
              <h3>Renal, Dialysis & Transplant</h3>
              <p style={{color:'#64748b'}}>CKD trajectories, dialysis adequacy & access surveillance, transplant monitoring, population stratification.</p>
            </div>
            <div className="card">
              <h3>Documentation Intelligence</h3>
              <p style={{color:'#64748b'}}>Summaries & prompts to improve specificity, compliance, and revenue integrity for renal care.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="renal">
        <div className="container">
          <div className="badge" style={{color:'#9333ea'}}>Renal AI</div>
          <h2>Analytics for nephrology and dialysis operations</h2>
          <div className="grid cols-3">
            <div className="card">
              <h3>CKD Progression</h3>
              <p style={{color:'#64748b'}}>eGFR trajectory modeling, albuminuria trends, and event forecasting with alert thresholds.</p>
            </div>
            <div className="card">
              <h3>High-Risk Patients</h3>
              <p style={{color:'#64748b'}}>Composite risk from multimodal features to surface patients needing timely intervention.</p>
            </div>
            <div className="card">
              <h3>Dialysis Modules</h3>
              <p style={{color:'#64748b'}}>Adequacy (Kt/V), access complication surveillance, hospitalization reduction, and quality reporting support.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="workflow">
        <div className="container">
          <div className="badge" style={{color:'#0ea5e9'}}>Workflow</div>
          <h2>How DVera orchestrates clinical data</h2>
          <p style={{color:'#64748b'}}>Seamless flow from ingestion to explainable output.</p>
          <div className="wf">
            <svg viewBox="0 0 1100 200" width="100%" height="220" aria-hidden="true">
              <defs>
                <linearGradient id="g" x1="0" x2="1">
                  <stop offset="0%" stopColor="#4f46e5"/>
                  <stop offset="50%" stopColor="#9333ea"/>
                  <stop offset="100%" stopColor="#0ea5e9"/>
                </linearGradient>
              </defs>
              <path className="wf-rail" d="M60 160 C 200 40, 420 40, 560 160 S 900 280, 1040 100"/>
              <path className="wf-trace" d="M60 160 C 200 40, 420 40, 560 160 S 900 280, 1040 100"/>
            </svg>
            <div className="wf-step" style={{left:'60px',top:'160px'}}>
              <span className="dot"></span><strong>Ingestion</strong>
              <div style={{fontSize:'.82rem',color:'#64748b'}}>Notes, labs, imaging, vitals</div>
            </div>
            <div className="wf-step" style={{left:'360px',top:'70px'}}>
              <span className="dot"></span><strong>Modeling</strong>
              <div style={{fontSize:'.82rem',color:'#64748b'}}>Multidimensional algorithms</div>
            </div>
            <div className="wf-step" style={{left:'660px',top:'165px'}}>
              <span className="dot"></span><strong>Analytics</strong>
              <div style={{fontSize:'.82rem',color:'#64748b'}}>Renal & dialysis modules</div>
            </div>
            <div className="wf-step" style={{left:'1040px',top:'100px'}}>
              <span className="dot"></span><strong>Output</strong>
              <div style={{fontSize:'.82rem',color:'#64748b'}}>Explainable diagnostics & CDI</div>
            </div>
          </div>
        </div>
      </section>

      <section id="security">
        <div className="container">
          <div className="badge" style={{color:'#64748b'}}>Security & Compliance</div>
          <h2>Protecting PHI by design</h2>
          <div className="grid cols-3">
            <div className="card">
              <h3>Encryption</h3>
              <p style={{color:'#64748b'}}>TLS in transit; AES-256 at rest; key rotation and secret management.</p>
            </div>
            <div className="card">
              <h3>Access Control</h3>
              <p style={{color:'#64748b'}}>RBAC, SSO (SAML/OIDC), SCIM provisioning; audit logging and approvals.</p>
            </div>
            <div className="card">
              <h3>Governance</h3>
              <p style={{color:'#64748b'}}>Data retention, lineage, row-level permissions, and immutable audit trails.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="enterprise">
        <div className="container">
          <div className="badge" style={{color:'#111827'}}>Enterprise</div>
          <h2>Operational readiness at scale</h2>
          <div className="grid cols-3">
            <div className="card">
              <h3>SLAs & Support</h3>
              <p style={{color:'#64748b'}}>Tiers up to 99.95% target uptime; incident response; named CSM; change control.</p>
            </div>
            <div className="card">
              <h3>Environments</h3>
              <p style={{color:'#64748b'}}>Sandbox, staging, production isolation; blue/green & canary deployments.</p>
            </div>
            <div className="card">
              <h3>Resilience</h3>
              <p style={{color:'#64748b'}}>Backup & restore, DR with configurable RPO/RTO, regional data residency.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="founder">
        <div className="container">
          <div className="badge" style={{color:'#334155'}}>Founder</div>
          <h2>Dr. Mehrdad Ghahremani-Ghajar</h2>
          <div className="founder-wrap">
            <div className="f-tabs" role="tablist">
              <button className="f-tab active" role="tab" onClick={(e) => {
                document.querySelectorAll('.f-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.f-panel').forEach(p => p.classList.remove('active'));
                e.target.classList.add('active');
                document.getElementById('f1').classList.add('active');
              }}>Academic Mission</button>
              <button className="f-tab" role="tab" onClick={(e) => {
                document.querySelectorAll('.f-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.f-panel').forEach(p => p.classList.remove('active'));
                e.target.classList.add('active');
                document.getElementById('f2').classList.add('active');
              }}>Corporate Leadership</button>
              <button className="f-tab" role="tab" onClick={(e) => {
                document.querySelectorAll('.f-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.f-panel').forEach(p => p.classList.remove('active'));
                e.target.classList.add('active');
                document.getElementById('f3').classList.add('active');
              }}>Innovation Pitch</button>
            </div>

            <div id="f1" className="f-panel active">
              <div className="bullet">
                <span className="dot"></span>
                <div><strong>Mission:</strong> advance nephrology through transparent, clinically-sound AI that complements physician judgment.</div>
              </div>
              <div className="bullet">
                <span className="dot"></span>
                <div><strong>Focus:</strong> CKD progression modeling, dialysis quality benchmarks, transplant surveillance, and equitable care.</div>
              </div>
              <div className="bullet">
                <span className="dot"></span>
                <div><strong>Standards:</strong> reproducible analytics, interpretable outputs, and continuous validation against real-world data.</div>
              </div>
            </div>

            <div id="f2" className="f-panel">
              <div className="accord" id="a1">
                <button type="button" onClick={(e) => {
                  const accord = e.target.closest('.accord');
                  accord.classList.toggle('open');
                }}>Executive Profile</button>
                <div className="content">
                  Nephrology physician and founder leading strategy, clinical safety, and model governance for DVeraâ„¢ â€“ aligning scientific rigor with operational scalability.
                </div>
              </div>
              <div className="accord" id="a2">
                <button type="button" onClick={(e) => {
                  const accord = e.target.closest('.accord');
                  accord.classList.toggle('open');
                }}>Clinical Governance</button>
                <div className="content">
                  Oversees evidence standards, labeling of models, bias monitoring, release criteria, and M&M-style review for adverse model events.
                </div>
              </div>
              <div className="accord" id="a3">
                <button type="button" onClick={(e) => {
                  const accord = e.target.closest('.accord');
                  accord.classList.toggle('open');
                }}>Partner Engagement</button>
                <div className="content">
                  Leads collaborations with health systems, dialysis providers, and payors to define outcomes-based deployments and value measurement.
                </div>
              </div>
            </div>

            <div id="f3" className="f-panel">
              <div className="bullet">
                <span className="dot"></span>
                <div><strong>Thesis:</strong> Multidimensional modeling + explainable analytics will close the gap between raw EHR data and real-time renal decision support.</div>
              </div>
              <div className="bullet">
                <span className="dot"></span>
                <div><strong>Differentiators:</strong> nephrology-first focus, transparent outputs, strong governance, and enterprise-grade interoperability.</div>
              </div>
              <div className="bullet">
                <span className="dot"></span>
                <div><strong>Outcomes:</strong> earlier CKD interventions, fewer dialysis complications, targeted care pathways, and documentation improvements.</div>
              </div>
              <div className="accord" id="a4">
                <button type="button" onClick={(e) => {
                  const accord = e.target.closest('.accord');
                  accord.classList.toggle('open');
                }}>Roadmap Snapshot</button>
                <div className="content">
                  Milestones include expansion of dialysis analytics, transplant graft surveillance features, and configurable risk stratification for population health.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="contact">
        <div className="container">
          <div className="badge" style={{color:'#4f46e5'}}>Contact</div>
          <h2>Get in touch</h2>
          <div className="grid cols-3">
            <div className="card">
              <h3>Address</h3>
              <p style={{color:'#64748b'}}>1325 East Cooley Drive Suite 109<br/>Colton, CA 92324</p>
            </div>
            <div className="card">
              <h3>Email</h3>
              <p><a href="mailto:info@diagnovera.com" style={{color:'#4f46e5'}}>info@diagnovera.com</a></p>
            </div>
            <div className="card">
              <h3>Phone</h3>
              <p><a href="tel:+18004438721" style={{color:'#4f46e5'}}>1-800-4-DVERA</a></p>
            </div>
          </div>
        </div>
      </section>

      <footer>
        <div className="container" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px',flexWrap:'wrap'}}>
          <div>Â© {new Date().getFullYear()} Diagnovera Inc. All rights reserved.</div>
          <div style={{display:'flex',gap:'18px',fontWeight:600}}>
            <a href="#enterprise" style={{color:'inherit',textDecoration:'none'}}>Enterprise</a>
            <a href="#security" style={{color:'inherit',textDecoration:'none'}}>Security</a>
            <a href="#platform" style={{color:'inherit',textDecoration:'none'}}>Platform</a>
            <a href="#contact" style={{color:'inherit',textDecoration:'none'}}>Contact</a>
          </div>
        </div>
      </footer>
    </>
  );
}