import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Home } from './pages/Home';
import { Auth } from './pages/Auth';
import { Dashboard } from './pages/Dashboard';
import { UserTemplates } from './pages/UserTemplates';
import { ContestDetail } from './pages/ContestDetail';
import { About } from './pages/About';
import { Privacy } from './pages/Privacy';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { isConfigured } from './lib/supabase';
import { getCurrentRoute, onRouteChange, initRouterFromBrowser, subscribeToBrowserNavigation } from './lib/router';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPath, setCurrentPath] = useState(() => initRouterFromBrowser());

  useEffect(() => {
    return onRouteChange((route) => setCurrentPath(route));
  }, []);

  useEffect(() => {
    return subscribeToBrowserNavigation(() => setCurrentPath(getCurrentRoute()));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  const contestMatch = currentPath.match(/^\/contest\/([a-f0-9-]+)$/);
  if (contestMatch) {
    return <ContestDetail contestId={contestMatch[1]} />;
  }

  if (currentPath === '/about') {
    return <About />;
  }

  if (currentPath === '/privacy') {
    return <Privacy />;
  }

  if (currentPath === '/templates/community') {
    return user ? <UserTemplates /> : <Auth />;
  }

  if (currentPath === '/auth') {
    return user ? <Dashboard /> : <Auth />;
  }

  return user ? <Dashboard /> : <Home />;
}

function App() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h1 className="text-white text-xl font-semibold mb-2">Configuration Error</h1>
          <p className="text-gray-400 text-sm mb-4">
            The app is missing required configuration. Please ensure the build was set up correctly with valid API credentials.
          </p>
          <div className="text-left bg-gray-800 rounded p-3 text-xs text-gray-300 break-all space-y-2">
            <p><span className="text-gray-500">URL:</span> {url ? url.substring(0, 40) + '...' : 'MISSING'}</p>
            <p><span className="text-gray-500">KEY:</span> {key ? key.substring(0, 20) + '...' : 'MISSING'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
