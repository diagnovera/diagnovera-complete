// pages/diagnoveraenterpriseinterface.js
import dynamic from 'next/dynamic';

// Completely disable SSR for this page to avoid hydration issues
const DiagnoVeraEnterprisePage = dynamic(
  () => import('../components/DiagnoVeraEnterpriseInterface').then(mod => mod.default),
  { 
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading DiagnoVera Enterprise Interface...</p>
        </div>
      </div>
    )
  }
);

export default DiagnoVeraEnterprisePage;