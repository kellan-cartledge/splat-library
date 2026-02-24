interface UploadProgressProps {
  sceneId: string | null;
  status: 'uploading' | 'processing' | 'complete' | 'error';
  progress: number;
  inputType?: 'video' | 'images';
}

export default function UploadProgress({ status, progress, inputType = 'video' }: UploadProgressProps) {
  if (status === 'error') {
    return (
      <div className="card-glow p-8 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-accent-red/10 border border-accent-red/20 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-accent-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h3 className="text-accent-red text-xl mb-2">Upload Failed</h3>
        <p className="text-text-secondary mb-6">Something went wrong. Please try again.</p>
        <button onClick={() => window.location.reload()} className="btn-secondary">Try Again</button>
      </div>
    );
  }

  return (
    <div className="card p-6 animate-fade-in">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-accent-cyan/10 border border-accent-cyan/30 flex items-center justify-center animate-glow-pulse">
          <svg className="w-6 h-6 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-text-primary text-lg mb-1">
            Uploading {inputType === 'images' ? 'images' : 'video'}...
          </p>
          <p className="text-text-muted text-sm">{progress}%</p>
        </div>
        <div className="w-full max-w-sm">
          <div className="h-2 bg-surface-overlay rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-accent-cyan to-accent-purple transition-all duration-500 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
