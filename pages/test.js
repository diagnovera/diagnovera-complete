export default function Test() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-blue-600 mb-4">DiagnoVera Test Page</h1>
        <p className="text-gray-600 mb-4">If you can see this, the deployment is working!</p>
        <p className="text-sm text-gray-500">Backend URL: {process.env.REACT_APP_BACKEND_URL || 'Not configured'}</p>
        <br />
        <a href="/" className="text-blue-500 hover:underline">Go to Main App</a>
      </div>
    </div>
  )
}