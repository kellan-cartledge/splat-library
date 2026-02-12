import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import { fetchScene } from '../../api/client';

interface UploadProgressProps {
  sceneId: string | null;
  status: 'uploading' | 'processing' | 'complete' | 'error';
  progress: number;
}

const PIPELINE_STAGES = [
  { key: 'uploading', label: 'Upload', description: 'Uploading video...' },
  { key: 'extracting_frames', label: 'Extract', description: 'Extracting frames from video...' },
  { key: 'running_colmap', label: 'COLMAP', description: 'Running structure from motion...' },
  { key: 'training_3dgs', label: 'Training', description: 'Training 3D Gaussian Splat...' },
  { key: 'converting', label: 'Convert', description: 'Converting to viewable format...' },
  { key: 'completed', label: 'Done', description: 'Processing complete!' },
];

const StageIcon = ({ stage, className }: { stage: string; className?: string }) => {
  const icons: Record<string, JSX.Element> = {
    uploading: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />,
    extracting_frames: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4" />,
    running_colmap: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />,
    training_3dgs: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />,
    converting: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />,
    completed: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />,
  };
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {icons[stage]}
    </svg>
  );
};

export default function UploadProgress({ sceneId, status, progress }: UploadProgressProps) {
  const [displayIndex, setDisplayIndex] = useState(0);
  const [barProgress, setBarProgress] = useState<number[]>([0, 0, 0, 0, 0]);
  const prevIndexRef = useRef(0);

  // Poll for processing stage updates
  const { data: scene } = useQuery({
    queryKey: ['scene', sceneId],
    queryFn: () => fetchScene(sceneId!),
    enabled: !!sceneId && status === 'processing',
    refetchInterval: 5000,
  });

  const processingStage = scene?.processingStage;
  
  // Determine current stage index
  let currentStageKey = status === 'uploading' ? 'uploading' : 
                        status === 'complete' ? 'completed' : 
                        (processingStage && processingStage !== 'pending') ? processingStage : 'extracting_frames';
  
  const currentIndex = PIPELINE_STAGES.findIndex(s => s.key === currentStageKey);
  const currentStage = PIPELINE_STAGES[currentIndex] || PIPELINE_STAGES[1];

  // Animate bar fill when stage changes
  useEffect(() => {
    if (currentIndex > prevIndexRef.current) {
      // Stage advanced - fill the previous bar(s)
      const newProgress = [...barProgress];
      for (let i = prevIndexRef.current; i < currentIndex; i++) {
        newProgress[i] = 100;
      }
      setBarProgress(newProgress);
      // Delay highlighting the new stage until bar fills
      setTimeout(() => setDisplayIndex(currentIndex), 500);
    } else if (currentIndex === 0 && status === 'uploading') {
      setDisplayIndex(0);
      setBarProgress([0, 0, 0, 0, 0]);
    }
    prevIndexRef.current = currentIndex;
  }, [currentIndex, status]);

  // Handle upload progress for first bar
  useEffect(() => {
    if (status === 'uploading') {
      setBarProgress(prev => [progress, ...prev.slice(1)]);
    }
  }, [progress, status]);

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
      {/* Pipeline Stepper */}
      <div className="flex items-center mb-8 px-4">
        {PIPELINE_STAGES.map((stage, i) => {
          const isDone = i < displayIndex;
          const isActive = i === displayIndex;
          return (
            <div key={stage.key} className={`flex items-center ${i < PIPELINE_STAGES.length - 1 ? 'flex-1' : ''}`}>
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
                  <StageIcon stage={stage.key} className="w-5 h-5" />
                </div>
                <span className={`mt-2 text-xs transition-colors duration-300 ${isDone || isActive ? 'text-text-primary' : 'text-text-muted'}`}>
                  {stage.label}
                </span>
              </div>
              {i < PIPELINE_STAGES.length - 1 && (
                <div className="flex-1 h-1 mx-2 mt-[-1rem] bg-surface-border rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-accent-green transition-all duration-700 ease-out"
                    style={{ width: `${barProgress[i]}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Status Message */}
      <div className="text-center space-y-4">
        {status !== 'complete' && <div className="spinner-lg mx-auto" />}
        <div>
          <p className="text-text-primary text-lg">{currentStage.description}</p>
          {status === 'processing' && (
            <p className="text-text-muted text-sm mt-1">This may take several minutes</p>
          )}
        </div>

        {/* Progress Bar (only during upload) */}
        {status === 'uploading' && (
          <div className="max-w-xs mx-auto">
            <div className="h-1 bg-surface-overlay rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-accent-cyan to-accent-purple transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {sceneId && (
          <p className="text-text-muted text-xs font-mono">Scene ID: {sceneId}</p>
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
