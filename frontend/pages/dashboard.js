// pages/dashboard.js
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import DiagnoVeraEnterpriseInterface from '../components/DiagnoVeraEnterpriseInterface';

export default function Dashboard() {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    document.cookie = 'authToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    router.push('/');
  };

  return (
    <div>
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
    </div>
  );
}