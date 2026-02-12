import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { fetchAuthSession } from 'aws-amplify/auth';
import SplatViewer from '../components/Viewer/SplatViewer';
import ProcessingStatus from '../components/Viewer/ProcessingStatus';
import { fetchScene, deleteScene } from '../api/client';

export default function ScenePage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const [copied, setCopied] = useState(false);
  const [showViewer, setShowViewer] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthenticator((context) => [context.user]);
  
  // Debug mode: ?stage=extracting_frames (or running_colmap, training_3dgs, converting, failed)
  const debugStage = searchParams.get('stage');
  
  const { data: scene, isLoading, error } = useQuery({
    queryKey: ['scene', id],
    queryFn: () => fetchScene(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'processing' || status === 'pending' ? 10000 : false;
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token) throw new Error('Not authenticated');
      return deleteScene(id!, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scenes'] });
      navigate('/gallery');
    }
  });

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isOwner = user && scene?.userId === user.userId;
  const isProcessing = scene?.status === 'processing' || scene?.status === 'pending';
  const isReady = scene?.status === 'completed' && (showViewer || scene.processingStage === 'completed');

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
          <button onClick={handleCopyLink} className="btn-secondary flex items-center gap-2">
            {copied ? (
              <>
                <svg className="w-4 h-4 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Copied!</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                <span>Share</span>
              </>
            )}
          </button>
          {isOwner && (
            <button onClick={() => setShowDeleteConfirm(true)} className="btn-ghost flex items-center gap-2 text-accent-red hover:text-accent-red hover:bg-accent-red/10">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Delete</span>
            </button>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="card-glow p-6 max-w-sm mx-4 animate-fade-up">
            <h3 className="text-text-primary text-lg font-medium mb-2">Delete Scene?</h3>
            <p className="text-text-secondary text-sm mb-6">This will permanently delete "{scene.name}" and all associated data. This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowDeleteConfirm(false)} className="btn-ghost">Cancel</button>
              <button 
                onClick={() => deleteMutation.mutate()} 
                disabled={deleteMutation.isPending}
                className="btn-primary !bg-accent-red hover:!shadow-[0_6px_20px_rgba(240,113,120,0.5)]"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="glow-line mb-6" />
      
      {/* Viewer or Processing Status */}
      <div className="card overflow-hidden animate-fade-up">
        <div className="aspect-video bg-surface-overlay">
          {debugStage || isProcessing || (scene.status === 'failed') || (scene.status === 'completed' && !showViewer && !scene.splatKey) ? (
            <ProcessingStatus 
              stage={debugStage || scene.processingStage || 'pending'} 
              error={scene.error}
              onViewSplat={() => setShowViewer(true)} 
            />
          ) : (
            <SplatViewer splatKey={scene.splatKey} />
          )}
        </div>
      </div>

      {/* Controls hint - only show when viewer is visible */}
      {isReady && scene.splatKey && (
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
      )}
    </div>
  );
}
