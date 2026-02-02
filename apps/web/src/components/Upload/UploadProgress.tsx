interface UploadProgressProps {
  sceneId: string | null;
  status: 'uploading' | 'processing' | 'complete' | 'error';
  progress: number;
}

export default function UploadProgress({ sceneId, status, progress }: UploadProgressProps) {
  return (
    <div className="text-center py-8">
      {status === 'error' ? (
        <div className="text-red-600">
          <p className="text-xl font-semibold">Upload Failed</p>
          <p className="mt-2">Please try again.</p>
        </div>
      ) : (
        <>
          <div className="spinner-lg mx-auto" />
          <p className="mt-4 text-lg font-medium">
            {status === 'uploading' ? 'Uploading video...' : 'Processing scene...'}
          </p>
          {sceneId && (
            <p className="mt-2 text-sm text-gray-500">Scene ID: {sceneId}</p>
          )}
          <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </>
      )}
    </div>
  );
}
