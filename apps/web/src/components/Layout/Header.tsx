import { Link } from 'react-router-dom';
import { useAuthenticator } from '@aws-amplify/ui-react';

export default function Header() {
  const { authStatus, signOut } = useAuthenticator((context) => [
    context.authStatus,
    context.signOut
  ]);

  return (
    <header className="bg-white shadow">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <Link to="/" className="text-xl font-bold text-blue-600">
          Splat Library
        </Link>
        
        <nav className="flex items-center gap-6">
          <Link to="/gallery" className="hover:text-blue-600">
            Gallery
          </Link>
          
          {authStatus === 'authenticated' ? (
            <>
              <Link to="/upload" className="hover:text-blue-600">
                Upload
              </Link>
              <button onClick={signOut} className="btn-secondary">
                Sign Out
              </button>
            </>
          ) : (
            <Link to="/" className="btn-primary">
              Sign In
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
