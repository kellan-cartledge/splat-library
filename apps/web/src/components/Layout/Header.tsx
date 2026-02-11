import { Link, useLocation } from 'react-router-dom';
import { useAuthenticator } from '@aws-amplify/ui-react';

export default function Header() {
  const { authStatus, signOut } = useAuthenticator((context) => [
    context.authStatus,
    context.signOut
  ]);
  const location = useLocation();

  const navLink = (to: string, label: string) => {
    const isActive = location.pathname === to;
    return (
      <Link
        to={to}
        className={`relative px-3 py-2 text-sm font-medium transition-colors ${
          isActive 
            ? 'text-accent-cyan' 
            : 'text-text-secondary hover:text-text-primary'
        }`}
      >
        {label}
        {isActive && (
          <span className="absolute bottom-0 left-3 right-3 h-px bg-accent-cyan" />
        )}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-50 border-b border-surface-border bg-surface-base/80 backdrop-blur-md">
      <div className="container mx-auto px-4 h-16 flex justify-between items-center">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-cyan to-accent-purple flex items-center justify-center">
            <svg className="w-5 h-5 text-surface-base" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2L2 7l8 5 8-5-8-5zM2 13l8 5 8-5M2 17l8 5 8-5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            </svg>
          </div>
          <span className="font-display font-semibold text-lg text-text-primary group-hover:text-accent-cyan transition-colors">
            Splat Library
          </span>
        </Link>
        
        <nav className="flex items-center gap-1">
          {navLink('/gallery', 'Gallery')}
          
          {authStatus === 'authenticated' ? (
            <>
              {navLink('/upload', 'Upload')}
              <div className="ml-4 pl-4 border-l border-surface-border flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
                <button onClick={signOut} className="btn-ghost text-sm">
                  Sign Out
                </button>
              </div>
            </>
          ) : (
            <Link to="/" className="ml-4 btn btn-secondary text-sm">
              Sign In
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
