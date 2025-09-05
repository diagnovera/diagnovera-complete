import React, { useState } from 'react';

export default function TestAPI() {
  const [status, setStatus] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  const testProcessA = async () => {
    setLoading(true);
    setStatus('Testing connection to Process A...');
    
    try {
      // Get the API URL from environment variable
      const apiUrl = process.env.NEXT_PUBLIC_PROCESS_A_API_URL || process.env.NEXT_PUBLIC_API_ENDPOINT;
      
      if (!apiUrl) {
        throw new Error('Process A API URL not configured');
      }

      // Test health endpoint
      const healthResponse = await fetch(`${apiUrl}/health`);
      const healthData = await healthResponse.json();
      
      setStatus('Health check successful! Testing analyze endpoint...');
      
      // Test analyze endpoint
      const testData = {
        patient_id: 'TEST-' + Date.now(),
        demographics: {
          age: '55',
          sex: 'M',
          mrn: '123456',
          name: 'Test Patient'
        },
        complex_plane_data: {
          subjective: [{
            name: 'Chest Pain',
            angle: 0,
            magnitude: 0.8,
            value: 'Severe'
          }],
          vitals: [{
            name: 'Heart Rate',
            angle: 60,
            magnitude: 0.9,
            value: 110
          }],
          laboratory: [],
          imaging: []
        },
        timestamp: new Date().toISOString()
      };

      const analyzeResponse = await fetch(`${apiUrl}/api/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData)
      });
      
      const analyzeData = await analyzeResponse.json();
      
      setResponse({
        health: healthData,
        analysis: analyzeData
      });
      setStatus('Connection successful!');
      
    } catch (error) {
      setStatus(`Error: ${error.message}`);
      setResponse(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '40px', fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Process A Connection Test</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <p><strong>API Endpoint:</strong> {process.env.NEXT_PUBLIC_PROCESS_A_API_URL || process.env.NEXT_PUBLIC_API_ENDPOINT || 'Not configured'}</p>
      </div>
      
      <button 
        onClick={testProcessA}
        disabled={loading}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          backgroundColor: loading ? '#ccc' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? 'Testing...' : 'Test Process A Connection'}
      </button>
      
      {status && (
        <div style={{ 
          marginTop: '20px', 
          padding: '10px', 
          backgroundColor: status.includes('Error') ? '#ffebee' : '#e8f5e9',
          borderRadius: '5px'
        }}>
          <strong>Status:</strong> {status}
        </div>
      )}
      
      {response && (
        <div style={{ marginTop: '20px' }}>
          <h3>Response:</h3>
          <pre style={{ 
            backgroundColor: '#f5f5f5', 
            padding: '15px', 
            borderRadius: '5px',
            overflow: 'auto'
          }}>
            {JSON.stringify(response, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
