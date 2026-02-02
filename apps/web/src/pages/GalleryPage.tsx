import { useScenes } from '../hooks/useScenes';
import SceneCard from '../components/Gallery/SceneCard';

export default function GalleryPage() {
  const { data: scenes, isLoading, error } = useScenes();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="spinner-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-600 p-8">
        Failed to load scenes. Please try again.
      </div>
    );
  }

  return (
    <div className="container-page">
      <h1 className="mb-8">Scene Gallery</h1>
      
      {scenes?.length === 0 ? (
        <div className="text-center text-gray-500 py-16">
          No scenes yet. Be the first to upload!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {scenes?.map((scene) => (
            <SceneCard key={scene.id} scene={scene} />
          ))}
        </div>
      )}
    </div>
  );
}
