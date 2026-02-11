import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import SplatViewer from '../components/Viewer/SplatViewer';
import { fetchScene } from '../api/client';

export default function ScenePage() {
  const { id } = useParams<{ id: string }>();
  const [copied, setCopied] = useState(false);
  
  const { data: scene, isLoading, error } = useQuery({
    queryKey: ['scene', id],
    queryFn: () => fetchScene(id!),
    enabled: !!id
  });

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="spinner-lg" />
        <p className="text-text-muted text-sm font-mono">Loading scene...</p>
      </div>
    );
  }

  if (error || !scene) {
    return (
      <div className="container-page">
        <div className="card-glow p-8 text-center max-w-md mx-auto">
          <div className="w-16 h-16 mx-auto rounded-full bg-accent-red/10 border border-accent-red/20 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-accent-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-text-primary text-xl mb-2">Scene not found</h3>
          <p className="text-text-secondary mb-6">This scene may have been deleted or doesn't exist.</p>
          <Link to="/gallery" className="btn-primary">
            Back to Gallery
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <Link to="/gallery" className="inline-flex items-center gap-2 text-text-secondary hover:text-accent-cyan transition-colors text-sm mb-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Gallery
          </Link>
          <h1 className="text-text-primary">{scene.name}</h1>
          {scene.description && (
            <p className="text-text-secondary mt-1">{scene.description}</p>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {scene.gaussianCount && (
            <span className="badge-info font-mono">
              {(scene.gaussianCount / 1000).toFixed(0)}K gaussians
            </span>
          )}
          <button onClick={handleCopyLink} className="btn-secondary text-sm">
            {copied ? (
              <>
                <svg className="w-4 h-4 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                Share
              </>
            )}
          </button>
        </div>
      </div>

      <div className="glow-line mb-6" />
      
      {/* Viewer */}
      <div className="card overflow-hidden animate-fade-up">
        <div className="aspect-video bg-surface-overlay">
          <SplatViewer splatKey={scene.splatKey} />
        </div>
      </div>

      {/* Controls hint */}
      <div className="mt-4 flex justify-center gap-6 text-text-muted text-sm">
        <span className="flex items-center gap-2">
          <kbd className="px-2 py-1 bg-surface-overlay border border-surface-border rounded text-xs font-mono">Drag</kbd>
          Rotate
        </span>
        <span className="flex items-center gap-2">
          <kbd className="px-2 py-1 bg-surface-overlay border border-surface-border rounded text-xs font-mono">Scroll</kbd>
          Zoom
        </span>
        <span className="flex items-center gap-2">
          <kbd className="px-2 py-1 bg-surface-overlay border border-surface-border rounded text-xs font-mono">Shift+Drag</kbd>
          Pan
        </span>
      </div>
    </div>
  );
}
