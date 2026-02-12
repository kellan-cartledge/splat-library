interface ProcessingStatusProps {
  stage?: string;
  error?: string;
  onViewSplat: () => void;
}

const STAGES = [
  { key: 'extracting_frames', label: 'Extract Frames', description: 'Extracting frames from video...' },
  { key: 'running_colmap', label: 'Analyze', description: 'Analyzing camera positions...' },
  { key: 'training_3dgs', label: 'Generate', description: 'Generating 3D Gaussian Splat...' },
  { key: 'converting', label: 'Converting', description: 'Converting to viewable format...' },
];

export default function ProcessingStatus({ stage, error, onViewSplat }: ProcessingStatusProps) {
  const currentIndex = STAGES.findIndex(s => s.key === stage);
  const isCompleted = stage === 'completed';
  const isFailed = stage === 'failed';

  if (isCompleted) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-6">
        <div className="w-20 h-20 rounded-full bg-accent-green/10 border border-accent-green/30 flex items-center justify-center">
          <svg className="w-10 h-10 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="text-center">
          <h3 className="text-text-primary text-xl mb-2">Processing Complete!</h3>
          <p className="text-text-secondary">Your 3D Gaussian Splat is ready to view.</p>
        </div>
        <button onClick={onViewSplat} className="btn-primary">
          View Splat
        </button>
      </div>
    );
  }

  if (isFailed) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-6">
        <div className="w-20 h-20 rounded-full bg-accent-red/10 border border-accent-red/30 flex items-center justify-center">
          <svg className="w-10 h-10 text-accent-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <div className="text-center">
          <h3 className="text-text-primary text-xl mb-2">Processing Failed</h3>
          <p className="text-text-secondary mb-2">Something went wrong during processing.</p>
          {error && <p className="text-text-muted text-sm font-mono mb-4">{error}</p>}
        </div>
        <a href="/upload" className="btn-secondary">
          Try Again
        </a>
      </div>
    );
  }

  const currentStage = STAGES[currentIndex] || STAGES[0];

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-8">
      <h3 className="text-text-primary text-xl">Processing Your Scene</h3>
      
      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STAGES.map((s, i) => {
          const isActive = i === currentIndex;
          const isDone = i < currentIndex;
          return (
            <div key={s.key} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-mono
                ${isDone ? 'bg-accent-green text-white' : isActive ? 'bg-accent-cyan text-white' : 'bg-surface-overlay text-text-muted border border-surface-border'}`}>
                {isDone ? '✓' : i + 1}
              </div>
              {i < STAGES.length - 1 && (
                <div className={`w-8 h-0.5 ${i < currentIndex ? 'bg-accent-green' : 'bg-surface-border'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Current stage info */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="spinner" />
          <span className="text-text-primary font-medium">{currentStage.label}</span>
        </div>
        <p className="text-text-secondary text-sm">{currentStage.description}</p>
        <p className="text-text-muted text-xs mt-2">This may take several minutes.</p>
      </div>
    </div>
  );
}
