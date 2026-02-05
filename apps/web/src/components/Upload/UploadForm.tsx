import { useState, useCallback, useRef } from 'react';
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
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.type.startsWith('video/')) {
      setFile(droppedFile);
    }
  }, []);

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
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`
            relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
            transition-all duration-200
            ${isDragging 
              ? 'border-accent-cyan bg-accent-cyan/5' 
              : 'border-surface-border hover:border-accent-cyan/50 hover:bg-surface-overlay/50'
            }
            ${file ? 'border-accent-green bg-accent-green/5' : ''}
          `}
        >
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="hidden"
            required
          />
          
          {file ? (
            <div className="space-y-2">
              <div className="w-12 h-12 mx-auto rounded-full bg-accent-green/10 border border-accent-green/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="font-mono text-accent-green text-sm">{file.name}</p>
              <p className="text-text-muted text-xs">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-surface-overlay border border-surface-border flex items-center justify-center">
                <svg className="w-6 h-6 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <p className="text-text-primary">Drop your video here or click to browse</p>
                <p className="text-text-muted text-sm mt-1">MP4, MOV, or WebM • 30-60 seconds recommended</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting || !file || !name}
        className="w-full btn-primary py-3 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <span className="spinner w-4 h-4" />
            Starting Upload...
          </span>
        ) : (
          'Upload & Process'
        )}
      </button>
    </form>
  );
}
