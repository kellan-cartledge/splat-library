import { useState, useCallback } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { getUploadUrl, createScene, startProcessing } from '../../api/client';

interface UploadFormProps {
  onUploadStart: (state: {
    sceneId: string | null;
    status: 'uploading' | 'processing' | 'error';
    progress: number;
  }) => void;
}

export default function UploadForm({ onUploadStart }: UploadFormProps) {
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !name) return;

    setIsSubmitting(true);

    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();

      const { sceneId, uploadUrl, key } = await getUploadUrl(file.name, file.type, token!);
      
      onUploadStart({ sceneId, status: 'uploading', progress: 0 });

      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
      });

      await createScene({ sceneId, name, videoKey: key }, token!);
      await startProcessing({ sceneId, videoKey: key }, token!);

      onUploadStart({ sceneId, status: 'processing', progress: 100 });
    } catch (error) {
      console.error('Upload failed:', error);
      onUploadStart({ sceneId: null, status: 'error', progress: 0 });
    }
  }, [file, name, onUploadStart]);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="label">Scene Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input"
          placeholder="My Awesome Scene"
          required
        />
      </div>

      <div>
        <label className="label">Video File</label>
        <input
          type="file"
          accept="video/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="w-full"
          required
        />
        <p className="text-sm text-gray-500 mt-1">
          Upload a video walking around your subject. 30-60 seconds recommended.
        </p>
      </div>

      <button
        type="submit"
        disabled={isSubmitting || !file || !name}
        className="w-full py-3 btn-primary"
      >
        {isSubmitting ? 'Starting Upload...' : 'Upload & Process'}
      </button>
    </form>
  );
}
