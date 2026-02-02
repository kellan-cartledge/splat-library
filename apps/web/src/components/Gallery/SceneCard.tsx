import { Link } from 'react-router-dom';
import { config } from '../../config';

interface Scene {
  id: string;
  name: string;
  thumbnailKey: string;
  createdAt: number;
  gaussianCount?: number;
}

interface SceneCardProps {
  scene: Scene;
}

export default function SceneCard({ scene }: SceneCardProps) {
  const thumbnailUrl = `${config.cdnUrl}/${scene.thumbnailKey}`;
  
  return (
    <Link to={`/scene/${scene.id}`} className="card-hover">
      <div className="aspect-video bg-gray-200">
        <img
          src={thumbnailUrl}
          alt={scene.name}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-lg truncate">{scene.name}</h3>
        <p className="text-sm text-gray-500">
          {new Date(scene.createdAt * 1000).toLocaleDateString()}
        </p>
        {scene.gaussianCount && (
          <p className="text-xs text-gray-400 mt-1">
            {(scene.gaussianCount / 1000).toFixed(0)}K gaussians
          </p>
        )}
      </div>
    </Link>
  );
}
