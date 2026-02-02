import { useState } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { Navigate } from 'react-router-dom';
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
      <h1 className="mb-8">Upload New Scene</h1>
      
      {uploadState.status === 'idle' ? (
        <UploadForm onUploadStart={setUploadState} />
      ) : (
        <UploadProgress 
          sceneId={uploadState.sceneId}
          status={uploadState.status}
          progress={uploadState.progress}
        />
      )}
    </div>
  );
}
