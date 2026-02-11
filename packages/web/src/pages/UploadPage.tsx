import { useState } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { Navigate, Link } from 'react-router-dom';
import UploadForm from '../components/Upload/UploadForm';
import UploadProgress from '../components/Upload/UploadProgress';

export default function UploadPage() {
  const { authStatus } = useAuthenticator((context) => [context.authStatus]);
  const [uploadState, setUploadState] = useState<{
    sceneId: string | null;
    status: 'idle' | 'uploading' | 'processing' | 'complete' | 'error';
    progress: number;
  }>({
    sceneId: null,
    status: 'idle',
    progress: 0
  });

  if (authStatus !== 'authenticated') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="container-page max-w-2xl">
      <div className="mb-8">
        <Link to="/gallery" className="inline-flex items-center gap-2 text-text-secondary hover:text-accent-cyan transition-colors text-sm mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Gallery
        </Link>
        <h1 className="text-text-primary">Upload New Scene</h1>
        <p className="text-text-secondary mt-2">Upload a video to generate a 3D gaussian splat scene</p>
      </div>

      <div className="glow-line mb-8" />
      
      {uploadState.status === 'idle' ? (
        <div className="animate-fade-up opacity-0 stagger-1">
          <UploadForm onUploadStart={setUploadState} />
        </div>
      ) : (
        <UploadProgress 
          sceneId={uploadState.sceneId}
          status={uploadState.status}
          progress={uploadState.progress}
        />
      )}

      {/* Tips Section */}
      <div className="mt-12 card p-6">
        <h3 className="text-text-primary mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-accent-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Tips for best results
        </h3>
        <ul className="space-y-2 text-sm text-text-secondary">
          <li className="flex items-start gap-2">
            <span className="text-accent-cyan">•</span>
            Use smooth, steady camera movements
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent-cyan">•</span>
            Capture the scene from multiple angles
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent-cyan">•</span>
            Ensure good lighting conditions
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent-cyan">•</span>
            Avoid motion blur and fast movements
          </li>
        </ul>
      </div>
    </div>
  );
}
