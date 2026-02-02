import { useEffect, useRef } from 'react';
import { config } from '../../config';

interface SplatViewerProps {
  splatKey: string;
}

export default function SplatViewer({ splatKey }: SplatViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const splatUrl = `${config.cdnUrl}/${splatKey}`;
    
    // TODO: Initialize Spark viewer when package is available
    console.log('Loading splat from:', splatUrl);

    return () => {
      // Cleanup viewer
    };
  }, [splatKey]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full min-h-viewer bg-black rounded-lg flex items-center justify-center"
    >
      <p className="text-white">3D Viewer Loading...</p>
    </div>
  );
}
