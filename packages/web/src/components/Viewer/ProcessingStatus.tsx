interface ProcessingStatusProps {
  stage?: string;
  error?: string;
  inputType?: 'video' | 'images';
  onViewSplat: () => void;
}

const VIDEO_STAGES = [
  { key: 'extracting_frames', label: 'Extract', description: 'Extracting frames from video...' },
  { key: 'running_colmap', label: 'Analyze', description: 'Analyzing camera positions...' },
  { key: 'training_3dgs', label: 'Generate', description: 'Generating 3D Gaussian Splat...' },
  { key: 'converting', label: 'Convert', description: 'Converting to viewable format...' },
];

const IMAGE_STAGES = [
  { key: 'running_colmap', label: 'Analyze', description: 'Analyzing camera positions...' },
  { key: 'training_3dgs', label: 'Generate', description: 'Generating 3D Gaussian Splat...' },
  { key: 'converting', label: 'Convert', description: 'Converting to viewable format...' },
];

const StageIcon = ({ stage, className }: { stage: string; className?: string }) => {
  const icons: Record<string, JSX.Element> = {
    extracting_frames: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4" />,
    running_colmap: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />,
    training_3dgs: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />,
    converting: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />,
  };
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {icons[stage]}
    </svg>
  );
};

export default function ProcessingStatus({ stage, error, inputType = 'video', onViewSplat }: ProcessingStatusProps) {
  const STAGES = inputType === 'images' ? IMAGE_STAGES : VIDEO_STAGES;
  const currentIndex = STAGES.findIndex(s => s.key === stage);
  const isCompleted = stage === 'completed';
  const isFailed = stage === 'failed';

  if (isCompleted) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-6">
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
      <div className="flex flex-col items-center justify-center py-8 gap-6">
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

  const resolvedIndex = currentIndex === -1 ? 0 : currentIndex;
  const currentStage = STAGES[resolvedIndex];

  return (
    <div className="flex flex-col items-center justify-center py-8 gap-6 w-full px-8">
      <h3 className="text-text-primary text-xl">Processing Your Scene</h3>
      
      {/* Stepper */}
      <div className="flex items-center w-full max-w-2xl px-4">
        {STAGES.map((s, i) => {
          const isActive = i === resolvedIndex;
          const isDone = i < resolvedIndex;
          return (
            <div key={s.key} className={`flex items-center ${i < STAGES.length - 1 ? 'flex-1' : ''}`}>
              <div className="flex flex-col items-center shrink-0">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center
                  transition-all duration-500
                  ${isDone 
                    ? 'bg-accent-green/20 text-accent-green border border-accent-green/30' 
                    : isActive 
                      ? 'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30 animate-glow-pulse' 
                      : 'bg-surface-overlay text-text-muted border border-surface-border'
                  }
                `}>
                  <StageIcon stage={s.key} className="w-5 h-5" />
                </div>
                <span className={`mt-2 text-xs transition-colors duration-300 ${isDone || isActive ? 'text-text-primary' : 'text-text-muted'}`}>
                  {s.label}
                </span>
              </div>
              {i < STAGES.length - 1 && (
                <div className="flex-1 h-1 mx-2 mt-[-1rem] bg-surface-border rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-accent-green transition-all duration-700 ease-out"
                    style={{ width: isDone ? '100%' : '0%' }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Current stage info */}
      <div className="text-center">
        <p className="text-text-primary font-medium mb-2">{currentStage.label}</p>
        <p className="text-text-secondary text-sm">{currentStage.description}</p>
        <p className="text-text-muted text-xs mt-2">This may take several minutes.</p>
        <div className="flex items-center justify-center gap-1.5 mt-3">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
