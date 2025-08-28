import { useEffect, useState } from 'react'

export default function Diagnostic() {
  const [diagnostics, setDiagnostics] = useState({
    diseaseDB: 'checking...',
    mainComponent: 'checking...',
    dependencies: 'checking...',
    error: null
  })

  useEffect(() => {
    const runDiagnostics = async () => {
      const results = { ...diagnostics }

      try {
        // Check if disease database can be imported
        const { diseaseDatabase, findSimilarDiseases } = await import('../components/diseaseDatabase')
        results.diseaseDB = `✓ Loaded (${Object.keys(diseaseDatabase || {}).length} diseases)`
      } catch (err) {
        results.diseaseDB = `✗ Error: ${err.message}`
        results.error = err
      }

      try {
        // Check if main component can be imported
       const DiagnoVera = await import('./diagnoveraenterpriseinterface')
        results.mainComponent = DiagnoVera.default ? '✓ Default export found' : '✗ No default export'
      } catch (err) {
        results.mainComponent = `✗ Error: ${err.message}`
        results.error = err
      }

      try {
        // Check key dependencies
        const deps = {
          react: await import('react'),
          d3: await import('d3'),
          axios: await import('axios'),
          socketio: await import('socket.io-client'),
          lucide: await import('lucide-react')
        }
        results.dependencies = '✓ All loaded'
      } catch (err) {
        results.dependencies = `✗ Error: ${err.message}`
      }

      setDiagnostics(results)
    }

    runDiagnostics()
  }, [])

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">DiagnoVera Diagnostics</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-4">
          <h2 className="text-xl font-semibold mb-4">Import Status</h2>
          <div className="space-y-2">
            <div>
              <span className="font-medium">Disease Database:</span> {diagnostics.diseaseDB}
            </div>
            <div>
              <span className="font-medium">Main Component:</span> {diagnostics.mainComponent}
            </div>
            <div>
              <span className="font-medium">Dependencies:</span> {diagnostics.dependencies}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-4">
          <h2 className="text-xl font-semibold mb-4">Environment</h2>
          <div className="space-y-2">
            <div>
              <span className="font-medium">Backend URL:</span> {process.env.REACT_APP_BACKEND_URL || 'Not set'}
            </div>
            <div>
              <span className="font-medium">Node Environment:</span> {process.env.NODE_ENV}
            </div>
          </div>
        </div>

        {diagnostics.error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-red-700">Error Details</h2>
            <pre className="text-sm text-red-600 overflow-auto">
              {JSON.stringify(diagnostics.error, null, 2)}
            </pre>
          </div>
        )}

        <div className="mt-6 space-x-4">
          <a href="/" className="text-blue-500 hover:underline">Try Main App</a>
          <a href="/test" className="text-blue-500 hover:underline">Test Page</a>
        </div>
      </div>
    </div>
  )
}