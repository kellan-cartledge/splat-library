import { Link } from 'react-router-dom';

interface UploadProgressProps {
  sceneId: string | null;
  status: 'uploading' | 'processing' | 'complete' | 'error';
  progress: number;
}

const steps = [
  { key: 'uploading', label: 'Uploading', icon: '↑' },
  { key: 'processing', label: 'Processing', icon: '⚙' },
  { key: 'complete', label: 'Complete', icon: '✓' },
];

export default function UploadProgress({ sceneId, status, progress }: UploadProgressProps) {
  const currentStep = steps.findIndex(s => s.key === status);

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
        <button onClick={() => window.location.reload()} className="btn-secondary">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="card p-8 animate-fade-in">
      {/* Progress Steps */}
      <div className="flex justify-between mb-8">
        {steps.map((step, i) => (
          <div key={step.key} className="flex-1 flex flex-col items-center">
            <div className={`
              w-10 h-10 rounded-full flex items-center justify-center text-lg font-mono
              transition-all duration-300
              ${i < currentStep 
                ? 'bg-accent-green/20 text-accent-green border border-accent-green/30' 
                : i === currentStep 
                  ? 'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30 animate-glow-pulse' 
                  : 'bg-surface-overlay text-text-muted border border-surface-border'
              }
            `}>
              {step.icon}
            </div>
            <span className={`mt-2 text-sm ${i <= currentStep ? 'text-text-primary' : 'text-text-muted'}`}>
              {step.label}
            </span>
            {i < steps.length - 1 && (
              <div className={`absolute h-0.5 w-full top-5 left-1/2 -z-10 ${i < currentStep ? 'bg-accent-green/30' : 'bg-surface-border'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Status Message */}
      <div className="text-center space-y-4">
        <div className="spinner-lg mx-auto" />
        <div>
          <p className="text-text-primary text-lg">
            {status === 'uploading' ? 'Uploading your video...' : 'Processing your scene...'}
          </p>
          <p className="text-text-muted text-sm mt-1">
            {status === 'processing' && 'This may take several minutes depending on video length'}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="max-w-xs mx-auto">
          <div className="h-1 bg-surface-overlay rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-accent-cyan to-accent-purple transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {sceneId && (
          <p className="text-text-muted text-xs font-mono">
            Scene ID: {sceneId}
          </p>
        )}
      </div>

      {status === 'complete' && (
        <div className="mt-8 text-center">
          <Link to={`/scene/${sceneId}`} className="btn-primary">
            View Scene
          </Link>
        </div>
      )}
    </div>
  );
}
