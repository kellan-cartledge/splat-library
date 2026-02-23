import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchScene } from '../api/client';
import ProcessingStatus from '../components/Viewer/ProcessingStatus';

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: scene, isLoading } = useQuery({
    queryKey: ['scene', id],
    queryFn: () => fetchScene(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'processing' || status === 'pending' ? 10000 : false;
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="spinner-lg" />
        <p className="text-text-muted text-sm font-mono">Loading job...</p>
      </div>
    );
  }

  if (!scene) {
    return (
      <div className="container-page">
        <div className="card-glow p-8 text-center max-w-md mx-auto">
          <h3 className="text-text-primary text-xl mb-2">Job not found</h3>
          <Link to="/jobs" className="btn-primary mt-4">Back to My Jobs</Link>
        </div>
      </div>
    );
  }

  const isCompleted = scene.status === 'completed';
  const formatTime = (ts?: number) => ts ? new Date(ts * 1000).toLocaleString() : '—';

  return (
    <div className="container-page">
      {/* Breadcrumb */}
      <Link to="/jobs" className="inline-flex items-center gap-2 text-text-secondary hover:text-accent-cyan transition-colors text-sm mb-4">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to My Jobs
      </Link>

      {/* Title */}
      <div className="mb-6">
        {isCompleted ? (
          <Link to={`/scene/${scene.id}`} className="text-text-primary text-2xl font-display hover:text-accent-cyan transition-colors">
            {scene.name}
          </Link>
        ) : (
          <h1 className="text-text-primary">{scene.name}</h1>
        )}
      </div>

      <div className="glow-line mb-6" />

      {/* Progress */}
      <div className="card overflow-hidden mb-6">
        <div className="aspect-video bg-surface-overlay flex items-center justify-center">
          <ProcessingStatus
            stage={scene.processingStage || 'pending'}
            error={scene.error}
            inputType={scene.inputType}
            onViewSplat={() => window.location.href = `/scene/${scene.id}`}
          />
        </div>
      </div>

      {/* Metadata */}
      <div className="card p-6">
        <h3 className="text-text-primary text-sm font-medium mb-4">Job Details</h3>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <dt className="text-text-muted mb-1">Input Type</dt>
            <dd className="text-text-primary capitalize">{scene.inputType || 'video'}</dd>
          </div>
          <div>
            <dt className="text-text-muted mb-1">Created</dt>
            <dd className="text-text-primary">{formatTime(scene.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-text-muted mb-1">Completed</dt>
            <dd className="text-text-primary">{formatTime(scene.completedAt)}</dd>
          </div>
          <div>
            <dt className="text-text-muted mb-1">Status</dt>
            <dd className="text-text-primary capitalize">{scene.status}</dd>
          </div>
          {scene.settings?.iterations && (
            <div>
              <dt className="text-text-muted mb-1">Iterations</dt>
              <dd className="text-text-primary font-mono">{scene.settings.iterations.toLocaleString()}</dd>
            </div>
          )}
          {scene.settings?.fps && (
            <div>
              <dt className="text-text-muted mb-1">FPS</dt>
              <dd className="text-text-primary font-mono">{scene.settings.fps}</dd>
            </div>
          )}
          {scene.settings?.densifyUntilIter && (
            <div>
              <dt className="text-text-muted mb-1">Densify Until</dt>
              <dd className="text-text-primary font-mono">{scene.settings.densifyUntilIter.toLocaleString()}</dd>
            </div>
          )}
          {scene.settings?.densificationInterval && (
            <div>
              <dt className="text-text-muted mb-1">Densify Interval</dt>
              <dd className="text-text-primary font-mono">{scene.settings.densificationInterval}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}
