# Splat Library - Frontend Specification

## Tech Stack

- React 18 + TypeScript
- Vite for build tooling
- TailwindCSS (modular organization)
- AWS Amplify for Cognito auth
- Spark (sparkjsdev/spark) for 3D viewer
- React Router for navigation
- TanStack Query for data fetching

---

## Project Setup

**apps/web/package.json**
```json
{
  "name": "@splat-library/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@aws-amplify/ui-react": "^6.0.0",
    "aws-amplify": "^6.0.0",
    "@tanstack/react-query": "^5.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.22.0",
    "@sparkjs/spark": "latest"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.4.0",
    "vite": "^5.1.0"
  }
}
```

---

## Modular TailwindCSS Structure

Organize styles for maintainability, scalability, and performance.

**apps/web/src/styles/base.css**
```css
@tailwind base;

@layer base {
  html {
    @apply antialiased;
  }
  
  body {
    @apply bg-gray-50 text-gray-900;
  }
  
  h1 {
    @apply text-3xl font-bold;
  }
  
  h2 {
    @apply text-2xl font-semibold;
  }
  
  h3 {
    @apply text-xl font-semibold;
  }
}
```

**apps/web/src/styles/components.css**
```css
@tailwind components;

@layer components {
  /* Buttons */
  .btn {
    @apply px-4 py-2 rounded-lg font-medium transition-colors;
  }
  
  .btn-primary {
    @apply btn bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50;
  }
  
  .btn-secondary {
    @apply btn bg-gray-200 text-gray-800 hover:bg-gray-300;
  }
  
  /* Cards */
  .card {
    @apply bg-white rounded-lg shadow-md overflow-hidden;
  }
  
  .card-hover {
    @apply card hover:shadow-lg transition-shadow;
  }
  
  /* Forms */
  .input {
    @apply w-full px-4 py-2 border border-gray-300 rounded-lg;
    @apply focus:ring-2 focus:ring-blue-500 focus:border-transparent;
  }
  
  .label {
    @apply block text-sm font-medium text-gray-700 mb-2;
  }
  
  /* Layout */
  .container-page {
    @apply container mx-auto px-4 py-8;
  }
  
  /* Loading */
  .spinner {
    @apply animate-spin rounded-full border-b-2 border-blue-600;
  }
  
  .spinner-lg {
    @apply spinner h-12 w-12;
  }
  
  /* Status badges */
  .badge {
    @apply inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium;
  }
  
  .badge-success {
    @apply badge bg-green-100 text-green-800;
  }
  
  .badge-warning {
    @apply badge bg-yellow-100 text-yellow-800;
  }
  
  .badge-error {
    @apply badge bg-red-100 text-red-800;
  }
  
  .badge-info {
    @apply badge bg-blue-100 text-blue-800;
  }
}
```

**apps/web/src/styles/utilities.css**
```css
@tailwind utilities;

@layer utilities {
  .text-balance {
    text-wrap: balance;
  }
  
  .aspect-video {
    aspect-ratio: 16 / 9;
  }
  
  .min-h-viewer {
    min-height: 500px;
  }
}
```

**apps/web/src/styles/index.css**
```css
/* Main entry point - imports modular styles */
@import './base.css';
@import './components.css';
@import './utilities.css';
```

**apps/web/tailwind.config.js**
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        }
      }
    }
  },
  plugins: []
};
```

---

## Application Structure

```
apps/web/src/
├── main.tsx
├── App.tsx
├── config.ts
├── styles/
│   ├── index.css           # Main entry
│   ├── base.css            # Base/reset styles
│   ├── components.css      # Reusable component classes
│   └── utilities.css       # Custom utilities
├── api/
│   └── client.ts
├── components/
│   ├── Gallery/
│   │   └── SceneCard.tsx
│   ├── Upload/
│   │   ├── UploadForm.tsx
│   │   └── UploadProgress.tsx
│   ├── Viewer/
│   │   └── SplatViewer.tsx
│   └── Layout/
│       ├── Header.tsx
│       └── Layout.tsx
├── hooks/
│   └── useScenes.ts
└── pages/
    ├── HomePage.tsx
    ├── GalleryPage.tsx
    ├── ScenePage.tsx
    └── UploadPage.tsx
```

---

## Core Components

**apps/web/src/main.tsx**
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Amplify } from 'aws-amplify';
import App from './App';
import { config } from './config';
import './styles/index.css';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: config.cognito.userPoolId,
      userPoolClientId: config.cognito.clientId
    }
  }
});

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
```

---

## 3D Viewer Component (using Spark)

**apps/web/src/components/Viewer/SplatViewer.tsx**
```tsx
import { useEffect, useRef } from 'react';
import { config } from '../../config';

interface SplatViewerProps {
  splatKey: string;
}

export default function SplatViewer({ splatKey }: SplatViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const initViewer = async () => {
      // Dynamic import for Spark
      const Spark = await import('@sparkjs/spark');
      
      const viewer = new Spark.Viewer({
        container: containerRef.current!,
        cameraPosition: [0, 0, 5],
        cameraTarget: [0, 0, 0],
      });

      viewerRef.current = viewer;

      const splatUrl = `${config.cdnUrl}/${splatKey}`;
      
      try {
        await viewer.load(splatUrl);
        viewer.start();
      } catch (error) {
        console.error('Failed to load splat:', error);
      }
    };

    initViewer();

    return () => {
      if (viewerRef.current) {
        viewerRef.current.dispose();
      }
    };
  }, [splatKey]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full min-h-viewer bg-black rounded-lg"
    />
  );
}
```

---

## Gallery Components

**apps/web/src/pages/GalleryPage.tsx**
```tsx
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
```

**apps/web/src/components/Gallery/SceneCard.tsx**
```tsx
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
```

---

## Upload Components

**apps/web/src/components/Upload/UploadForm.tsx**
```tsx
import { useState, useCallback } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { getUploadUrl, createScene, startProcessing } from '../../api/client';

interface UploadFormProps {
  onUploadStart: (state: {
    sceneId: string | null;
    status: 'uploading' | 'processing';
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
      onUploadStart({ sceneId: null, status: 'error' as any, progress: 0 });
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
```

---

## Layout Components

**apps/web/src/components/Layout/Header.tsx**
```tsx
import { Link } from 'react-router-dom';
import { useAuthenticator } from '@aws-amplify/ui-react';

export default function Header() {
  const { authStatus, signOut } = useAuthenticator((context) => [
    context.authStatus,
    context.signOut
  ]);

  return (
    <header className="bg-white shadow">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <Link to="/" className="text-xl font-bold text-blue-600">
          Splat Library
        </Link>
        
        <nav className="flex items-center gap-6">
          <Link to="/gallery" className="hover:text-blue-600">
            Gallery
          </Link>
          
          {authStatus === 'authenticated' ? (
            <>
              <Link to="/upload" className="hover:text-blue-600">
                Upload
              </Link>
              <button onClick={signOut} className="btn-secondary">
                Sign Out
              </button>
            </>
          ) : (
            <Link to="/" className="btn-primary">
              Sign In
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
```

---

## .gitignore for web app

**apps/web/.gitignore**
```
# Dependencies
node_modules/

# Build
dist/
build/

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/

# Logs
*.log

# Cache
.cache/
.turbo/
```
