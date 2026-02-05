import { Link } from 'react-router-dom';
import { config } from '../../config';

interface Scene {
  id: string;
  name: string;
  thumbnailKey: string;
  createdAt: number;
  gaussianCount?: number;
  status?: string;
}

interface SceneCardProps {
  scene: Scene;
}

export default function SceneCard({ scene }: SceneCardProps) {
  const thumbnailUrl = `${config.cdnUrl}/${scene.thumbnailKey}`;
  
  const statusBadge = () => {
    switch (scene.status) {
      case 'complete':
        return <span className="badge-success">Ready</span>;
      case 'processing':
        return <span className="badge-warning">Processing</span>;
      case 'failed':
        return <span className="badge-error">Failed</span>;
      default:
        return <span className="badge-info">Pending</span>;
    }
  };
  
  return (
    <Link to={`/scene/${scene.id}`} className="card-hover group">
      <div className="aspect-video bg-surface-overlay relative overflow-hidden">
        <img
          src={thumbnailUrl}
          alt={scene.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-surface-base/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute top-3 right-3">
          {statusBadge()}
        </div>
      </div>
      <div className="p-4 space-y-2">
        <h3 className="font-display font-semibold text-text-primary truncate group-hover:text-accent-cyan transition-colors">
          {scene.name}
        </h3>
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-muted font-mono">
            {new Date(scene.createdAt * 1000).toLocaleDateString()}
          </span>
          {scene.gaussianCount && (
            <span className="text-accent-cyan font-mono">
              {(scene.gaussianCount / 1000).toFixed(0)}K pts
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
