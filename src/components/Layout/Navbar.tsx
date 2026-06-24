import { useAuth } from '../../contexts/AuthContext';
import { Trophy, LogOut, User, LayoutDashboard, Menu, X, Info, Trash2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { navigate, getCurrentRoute, onRouteChange } from '../../lib/router';

export function Navbar() {
  const { profile, displayName, signOut } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [currentPath, setCurrentPath] = useState(getCurrentRoute());
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return onRouteChange(route => setCurrentPath(route));
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const handleNavigate = (path: string) => {
    navigate(path as Parameters<typeof navigate>[0]);
    setShowMobileMenu(false);
  };

  const handleSignOut = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDropdown(false);
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-xl flex items-center justify-center">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                KlashBoard
              </span>
            </button>

            <div className="hidden md:flex items-center gap-2 ml-4">
              <button
                onClick={() => navigate('/dashboard')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                  currentPath === '/dashboard' || currentPath === '/'
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                My Challenges
              </button>
              <button
                onClick={() => navigate('/about')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                  currentPath === '/about'
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Info className="w-4 h-4" />
                About
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition"
            >
              {showMobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <span className="hidden sm:block text-sm font-medium text-gray-700">
                  {displayName}
                </span>
              </button>

              {showDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">{displayName}</p>
                    <p className="text-xs text-gray-500">{profile?.email}</p>
                  </div>
                  <button
                    onMouseDown={() => {
                      setShowDropdown(false);
                      navigate('/delete-account');
                    }}
                    className="w-full px-4 py-2 text-sm text-left text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete account
                  </button>
                  <button
                    onMouseDown={handleSignOut}
                    className="w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {showMobileMenu && (
          <div className="md:hidden border-t border-gray-200 py-2">
            <button
              onClick={() => handleNavigate('/dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition ${
                currentPath === '/dashboard' || currentPath === '/'
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <LayoutDashboard className="w-5 h-5" />
              My Challenges
            </button>
            <button
              onClick={() => handleNavigate('/about')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition ${
                currentPath === '/about'
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Info className="w-5 h-5" />
              About
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
