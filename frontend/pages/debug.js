export default function Debug() {
  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>Debug Information</h1>
      <hr />
      <h2>Environment Variables:</h2>
      <p>REACT_APP_BACKEND_URL: {process.env.REACT_APP_BACKEND_URL || 'NOT SET'}</p>
      <p>NODE_ENV: {process.env.NODE_ENV}</p>
      
      <hr />
      <h2>Quick Tests:</h2>
      <p>1. Basic React: ✓ Working (you can see this page)</p>
      <p>2. Tailwind CSS: <span className="text-green-500 font-bold">Test Green Text</span></p>
      <p>3. Backend URL Configured: {process.env.REACT_APP_BACKEND_URL ? '✓' : '✗'}</p>
      
      <hr />
      <h2>Component Load Test:</h2>
      <button 
        onClick={() => {
          import('./diagnoveraenterpriseinterface')
            .then(mod => {
              console.log('Component loaded:', mod);
              alert('Component loaded successfully! Check console for details.');
            })
            .catch(err => {
              console.error('Failed to load component:', err);
              alert('Failed to load component! Error: ' + err.message);
            });
        }}
        style={{
          padding: '10px 20px',
          backgroundColor: '#3B82F6',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        Test Load Component
      </button>
      
      <hr />
      <h2>Disease DB Test:</h2>
      <button 
        onClick={() => {
          import('../components/diseaseDatabase')
            .then(mod => {
              console.log('Disease DB loaded:', mod);
              alert('Disease DB loaded! Contains ' + Object.keys(mod.diseaseDatabase || {}).length + ' diseases');
            })
            .catch(err => {
              console.error('Failed to load disease DB:', err);
              alert('Failed to load disease DB! Error: ' + err.message);
            });
        }}
        style={{
          padding: '10px 20px',
          backgroundColor: '#10B981',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
          marginTop: '10px'
        }}
      >
        Test Load Disease DB
      </button>
      
      <hr />
      <div style={{ marginTop: '20px' }}>
        <a href="/" style={{ color: 'blue', marginRight: '20px' }}>Go to Main App</a>
        <a href="/test" style={{ color: 'blue' }}>Go to Test Page</a>
      </div>
    </div>
  );
}