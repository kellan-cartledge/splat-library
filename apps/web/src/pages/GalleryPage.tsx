import { useScenes } from '../hooks/useScenes';
import SceneCard from '../components/Gallery/SceneCard';

export default function GalleryPage() {
  const { data: scenes, isLoading, error } = useScenes();

  return (
    <div className="container-page">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-text-primary">Scene Gallery</h1>
          <p className="text-text-secondary mt-2">Browse and explore 3D gaussian splat scenes</p>
        </div>
        {scenes && scenes.length > 0 && (
          <span className="badge-info font-mono">{scenes.length} scenes</span>
        )}
      </div>

      <div className="glow-line mb-8" />

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="spinner-lg" />
          <p className="text-text-muted text-sm font-mono">Loading scenes...</p>
        </div>
      ) : error ? (
        <div className="card-glow p-8 text-center max-w-md mx-auto">
          <div className="w-12 h-12 mx-auto rounded-full bg-accent-red/10 border border-accent-red/20 flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-accent-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-accent-red mb-4">Failed to load scenes</p>
          <button onClick={() => window.location.reload()} className="btn-secondary">
            Try Again
          </button>
        </div>
      ) : scenes?.length === 0 ? (
        <div className="card p-12 text-center max-w-lg mx-auto">
          <div className="w-16 h-16 mx-auto rounded-full bg-surface-overlay border border-surface-border flex items-center justify-center mb-6">
            <svg className="w-8 h-8 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-text-primary mb-2">No scenes yet</h3>
          <p className="text-text-secondary text-sm mb-6">Be the first to upload a video and create a 3D scene</p>
          <a href="/upload" className="btn btn-primary">
            Upload Video
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {scenes?.map((scene, i) => (
            <div key={scene.id} className={`animate-fade-up opacity-0`} style={{ animationDelay: `${i * 0.1}s` }}>
              <SceneCard scene={scene} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
