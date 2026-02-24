import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { fetchMyScenes, Scene } from '../api/client';

function relativeTime(scene: Scene): string {
  const now = Date.now() / 1000;
  let ts = scene.createdAt;
  let prefix = 'Started';
  if (scene.status === 'completed' && scene.completedAt) {
    ts = scene.completedAt;
    prefix = 'Completed';
  } else if (scene.status === 'failed') {
    prefix = 'Failed';
  }
  const diff = Math.max(0, now - ts);
  if (diff < 60) return `${prefix} just now`;
  if (diff < 3600) return `${prefix} ${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${prefix} ${Math.floor(diff / 3600)}h ago`;
  return `${prefix} ${Math.floor(diff / 86400)}d ago`;
}

function StatusBadge({ scene }: { scene: Scene }) {
  if (scene.status === 'completed') {
    return <span className="badge-success">Completed</span>;
  }
  if (scene.status === 'failed') {
    return <span className="badge-error">Failed</span>;
  }
  const stageLabels: Record<string, string> = {
    pending: 'Pending',
    extracting_frames: 'Extract',
    running_colmap: 'Analyze',
    training_3dgs: 'Generate',
    converting: 'Convert',
  };
  const label = stageLabels[scene.processingStage || 'pending'] || 'Processing';
  return <span className="badge-warning animate-pulse">{label}</span>;
}

function JobsList() {
  const navigate = useNavigate();
  const { data: scenes, isLoading, error } = useQuery({
    queryKey: ['myScenes'],
    queryFn: async () => {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token) throw new Error('Not authenticated');
      return fetchMyScenes(token);
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.some(s => s.status === 'pending' || s.status === 'processing')) return 10000;
      return false;
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="spinner-lg" />
        <p className="text-text-muted text-sm font-mono">Loading jobs...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card-glow p-8 text-center max-w-md mx-auto">
        <p className="text-accent-red mb-4">Failed to load jobs</p>
        <button onClick={() => window.location.reload()} className="btn-secondary">Try Again</button>
      </div>
    );
  }

  if (!scenes?.length) {
    return (
      <div className="card p-12 text-center max-w-lg mx-auto">
        <div className="w-16 h-16 mx-auto rounded-full bg-surface-overlay border border-surface-border flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </div>
        <h3 className="text-text-primary mb-2">No jobs yet</h3>
        <p className="text-text-secondary text-sm mb-6">Upload a video or images to create your first 3D scene</p>
        <Link to="/upload" className="btn btn-primary">Upload</Link>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-surface-border text-left text-text-secondary text-sm">
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium text-right">Time</th>
          </tr>
        </thead>
        <tbody>
          {scenes.map((scene, i) => (
            <tr key={scene.id} onClick={() => navigate(`/jobs/${scene.id}`)} className={`border-b border-surface-border/50 hover:bg-surface-overlay/50 transition-colors cursor-pointer animate-fade-up opacity-0`} style={{ animationDelay: `${i * 0.05}s` }}>
              <td className="px-4 py-3 text-text-primary">{scene.name}</td>
              <td className="px-4 py-3"><StatusBadge scene={scene} /></td>
              <td className="px-4 py-3 text-text-secondary text-sm capitalize">{scene.inputType || 'video'}</td>
              <td className="px-4 py-3 text-text-muted text-sm text-right">{relativeTime(scene)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function JobsPage() {
  const { authStatus } = useAuthenticator((context) => [context.authStatus]);

  return (
    <div className="container-page">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-text-primary">My Jobs</h1>
          <p className="text-text-secondary mt-2">Track your scene processing jobs</p>
        </div>
        <Link to="/upload" className="btn btn-primary">New Upload</Link>
      </div>
      <div className="glow-line mb-8" />
      {authStatus === 'authenticated' ? (
        <JobsList />
      ) : (
        <section className="card p-8 max-w-md mx-auto">
          <p className="text-text-secondary text-center mb-6">Sign in to view your jobs</p>
          <Authenticator />
        </section>
      )}
    </div>
  );
}
