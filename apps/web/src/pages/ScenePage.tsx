import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import SplatViewer from '../components/Viewer/SplatViewer';
import { fetchScene } from '../api/client';

export default function ScenePage() {
  const { id } = useParams<{ id: string }>();
  
  const { data: scene, isLoading, error } = useQuery({
    queryKey: ['scene', id],
    queryFn: () => fetchScene(id!),
    enabled: !!id
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="spinner-lg" />
      </div>
    );
  }

  if (error || !scene) {
    return (
      <div className="text-center text-red-600 p-8">
        Scene not found.
      </div>
    );
  }

  return (
    <div className="container-page">
      <div className="mb-6">
        <h1>{scene.name}</h1>
        {scene.description && (
          <p className="text-gray-600 mt-2">{scene.description}</p>
        )}
      </div>
      
      <div className="aspect-video">
        <SplatViewer splatKey={scene.splatKey} />
      </div>
      
      <div className="mt-6 flex gap-4">
        <button
          onClick={() => navigator.clipboard.writeText(window.location.href)}
          className="btn-secondary"
        >
          Copy Link
        </button>
      </div>
    </div>
  );
}
