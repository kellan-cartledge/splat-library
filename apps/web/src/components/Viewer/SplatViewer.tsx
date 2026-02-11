import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { SplatMesh } from '@sparkjsdev/spark';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { config } from '../../config';

interface SplatViewerProps {
  splatKey: string;
}

export default function SplatViewer({ splatKey }: SplatViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || rendererRef.current) return;

    const container = containerRef.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 5);
    
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    rendererRef.current = renderer;
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const splatUrl = `${config.cdnUrl}/${splatKey}`;

    const splat = new SplatMesh({ url: splatUrl });
    // Rotate 180° around X-axis to convert from OpenCV to OpenGL coordinates
    splat.quaternion.set(1, 0, 0, 0);
    scene.add(splat);
    setLoading(false);

    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
      rendererRef.current = null;
    };
  }, [splatKey]);

  return (
    <div ref={containerRef} className="w-full h-full min-h-viewer bg-black rounded-lg relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-white">Loading 3D scene...</p>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-red-400">Error: {error}</p>
        </div>
      )}
    </div>
  );
}
