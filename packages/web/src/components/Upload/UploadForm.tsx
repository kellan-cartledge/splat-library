import { useState, useCallback, useRef } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { getUploadUrl, getImageUploadUrls, createScene, startProcessing } from '../../api/client';

type InputType = 'video' | 'images';

interface UploadFormProps {
  onUploadStart: (state: {
    sceneId: string | null;
    status: 'uploading' | 'processing' | 'error';
    progress: number;
    inputType?: InputType;
  }) => void;
}

const DEFAULTS = {
  fps: 3,
  iterations: 7000,
  densifyUntilIter: 5000,
  densificationInterval: 100
};

const IMAGE_ACCEPT = '.jpg,.jpeg,.png';
const MAX_IMAGE_SIZE = 50 * 1024 * 1024;
const UPLOAD_CONCURRENCY = 5;

export default function UploadForm({ onUploadStart }: UploadFormProps) {
  const [inputType, setInputType] = useState<InputType>('video');
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [settings, setSettings] = useState(DEFAULTS);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleImageFiles = useCallback((files: FileList | File[]) => {
    const valid = Array.from(files).filter(f => {
      const ext = f.name.toLowerCase();
      return (ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.png')) && f.size <= MAX_IMAGE_SIZE;
    });
    setImageFiles(prev => [...prev, ...valid]);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (inputType === 'images') {
      handleImageFiles(e.dataTransfer.files);
    } else {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile?.type.startsWith('video/')) setFile(droppedFile);
    }
  }, [inputType, handleImageFiles]);

  const removeImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const hasFiles = inputType === 'video' ? !!file : imageFiles.length > 0;
    if (!hasFiles || !name) return;

    setIsSubmitting(true);

    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString()!;

      if (inputType === 'images') {
        const files = imageFiles.map(f => ({ filename: f.name, contentType: f.type || 'image/jpeg' }));
        const { sceneId, uploads } = await getImageUploadUrls(files, token);

        onUploadStart({ sceneId, status: 'uploading', progress: 0, inputType: 'images' });

        // Parallel upload with concurrency limit
        let completed = 0;
        const total = uploads.length;
        const queue = uploads.map((u, i) => async () => {
          await fetch(u.uploadUrl, {
            method: 'PUT',
            body: imageFiles[i],
            headers: { 'Content-Type': imageFiles[i].type || 'image/jpeg' }
          });
          completed++;
          onUploadStart({ sceneId, status: 'uploading', progress: Math.round((completed / total) * 100), inputType: 'images' });
        });

        // Process in batches
        for (let i = 0; i < queue.length; i += UPLOAD_CONCURRENCY) {
          await Promise.all(queue.slice(i, i + UPLOAD_CONCURRENCY).map(fn => fn()));
        }

        await createScene({ sceneId, name, inputType: 'images' }, token);
        await startProcessing({ sceneId, inputType: 'images', ...settings }, token);
        onUploadStart({ sceneId, status: 'processing', progress: 100, inputType: 'images' });
      } else {
        const { sceneId, uploadUrl, key } = await getUploadUrl(file!.name, file!.type, token);
        onUploadStart({ sceneId, status: 'uploading', progress: 0, inputType: 'video' });

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              onUploadStart({ sceneId, status: 'uploading', progress: Math.round((e.loaded / e.total) * 100), inputType: 'video' });
            }
          };
          xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`));
          xhr.onerror = () => reject(new Error('Upload failed'));
          xhr.open('PUT', uploadUrl);
          xhr.setRequestHeader('Content-Type', file!.type);
          xhr.send(file);
        });
        await createScene({ sceneId, name, videoKey: key, inputType: 'video' }, token);
        await startProcessing({ sceneId, inputType: 'video', videoKey: key, ...settings }, token);
        onUploadStart({ sceneId, status: 'processing', progress: 100, inputType: 'video' });
      }
    } catch (error) {
      console.error('Upload failed:', error);
      onUploadStart({ sceneId: null, status: 'error', progress: 0 });
    }
  }, [file, imageFiles, name, settings, inputType, onUploadStart]);

  const totalImageSize = imageFiles.reduce((sum, f) => sum + f.size, 0);
  const hasFiles = inputType === 'video' ? !!file : imageFiles.length > 0;

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

      {/* Input Type Toggle */}
      <div className="flex gap-2 p-1 bg-surface-overlay rounded-lg border border-surface-border">
        {(['video', 'images'] as const).map(type => (
          <button
            key={type}
            type="button"
            onClick={() => { setInputType(type); setFile(null); setImageFiles([]); }}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
              inputType === type
                ? 'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {type === 'video' ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Video
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Images
              </span>
            )}
          </button>
        ))}
      </div>

      {/* File Drop Zone */}
      <div>
        <label className="label">{inputType === 'video' ? 'Video File' : 'Image Files'}</label>
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
            ${hasFiles ? 'border-accent-green bg-accent-green/5' : ''}
          `}
        >
          <input
            ref={inputRef}
            type="file"
            accept={inputType === 'video' ? 'video/*' : IMAGE_ACCEPT}
            multiple={inputType === 'images'}
            onChange={(e) => {
              if (inputType === 'images') {
                if (e.target.files) handleImageFiles(e.target.files);
              } else {
                setFile(e.target.files?.[0] || null);
              }
              e.target.value = '';
            }}
            className="hidden"
          />

          {inputType === 'video' && file ? (
            <div className="space-y-2">
              <div className="w-12 h-12 mx-auto rounded-full bg-accent-green/10 border border-accent-green/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="font-mono text-accent-green text-sm">{file.name}</p>
              <p className="text-text-muted text-xs">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
          ) : inputType === 'images' && imageFiles.length > 0 ? (
            <div className="space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-accent-green/10 border border-accent-green/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="font-mono text-accent-green text-sm">{imageFiles.length} images selected</p>
              <p className="text-text-muted text-xs">{(totalImageSize / 1024 / 1024).toFixed(1)} MB total</p>
              {imageFiles.length < 20 && (
                <p className="text-accent-yellow text-xs">⚠ Fewer than 20 images — COLMAP works best with 20+ images for good reconstruction</p>
              )}
              <p className="text-text-muted text-xs">Click or drop to add more</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-surface-overlay border border-surface-border flex items-center justify-center">
                <svg className="w-6 h-6 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <p className="text-text-primary">
                  {inputType === 'video'
                    ? 'Drop your video here or click to browse'
                    : 'Drop your images here or click to browse'}
                </p>
                <p className="text-text-muted text-sm mt-1">
                  {inputType === 'video'
                    ? 'MP4, MOV, or WebM • 30-60 seconds recommended'
                    : 'JPG or PNG • 50MB max per image • 20+ images recommended'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Image file list */}
      {inputType === 'images' && imageFiles.length > 0 && (
        <div className="max-h-40 overflow-y-auto space-y-1 text-xs">
          {imageFiles.map((f, i) => (
            <div key={`${f.name}-${i}`} className="flex items-center justify-between px-3 py-1.5 bg-surface-overlay rounded">
              <span className="text-text-secondary font-mono truncate flex-1">{f.name}</span>
              <span className="text-text-muted mx-2">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
              <button type="button" onClick={() => removeImage(i)} className="text-text-muted hover:text-accent-red">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Advanced Settings */}
      <div className="border border-surface-border rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full px-4 py-3 flex items-center justify-between text-left bg-surface-overlay hover:bg-surface-overlay/80 transition-colors"
        >
          <span className="text-text-secondary text-sm">Advanced Settings</span>
          <svg className={`w-4 h-4 text-text-muted transition-transform ${showAdvanced ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showAdvanced && (
          <div className="p-4 space-y-4 border-t border-surface-border">
            <div className={`grid ${inputType === 'video' ? 'grid-cols-2' : 'grid-cols-2'} gap-4`}>
              {inputType === 'video' && (
                <div>
                  <label className="label text-xs">Frame Rate (fps)</label>
                  <input
                    type="number"
                    value={settings.fps}
                    onChange={(e) => setSettings(s => ({ ...s, fps: Number(e.target.value) }))}
                    className="input text-sm"
                    min={1} max={10}
                  />
                  <p className="text-text-muted text-xs mt-1">Frames extracted per second</p>
                </div>
              )}
              <div>
                <label className="label text-xs">Training Iterations</label>
                <input
                  type="number"
                  value={settings.iterations}
                  onChange={(e) => setSettings(s => ({ ...s, iterations: Number(e.target.value) }))}
                  className="input text-sm"
                  min={1000} max={100000} step={1000}
                />
                <p className="text-text-muted text-xs mt-1">More = better quality, slower</p>
              </div>
              <div>
                <label className="label text-xs">Densify Until Iteration</label>
                <input
                  type="number"
                  value={settings.densifyUntilIter}
                  onChange={(e) => setSettings(s => ({ ...s, densifyUntilIter: Number(e.target.value) }))}
                  className="input text-sm"
                  min={1000} max={50000} step={1000}
                />
                <p className="text-text-muted text-xs mt-1">When to stop adding gaussians</p>
              </div>
              <div>
                <label className="label text-xs">Densification Interval</label>
                <input
                  type="number"
                  value={settings.densificationInterval}
                  onChange={(e) => setSettings(s => ({ ...s, densificationInterval: Number(e.target.value) }))}
                  className="input text-sm"
                  min={50} max={500} step={50}
                />
                <p className="text-text-muted text-xs mt-1">Iterations between densification</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSettings(DEFAULTS)}
              className="text-accent-cyan text-xs hover:underline"
            >
              Reset to defaults
            </button>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting || !hasFiles || !name}
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
