import { config } from '../config';

const API = config.apiUrl;

export interface Scene {
  id: string;
  name: string;
  description?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  processingStage?: 'pending' | 'extracting_frames' | 'running_colmap' | 'training_3dgs' | 'converting' | 'completed' | 'failed';
  error?: string;
  thumbnailKey: string;
  splatKey: string;
  createdAt: number;
  completedAt?: number;
  gaussianCount?: number;
}

export async function fetchScenes(): Promise<Scene[]> {
  const res = await fetch(`${API}/scenes`);
  if (!res.ok) throw new Error('Failed to fetch scenes');
  return res.json();
}

export async function fetchScene(id: string): Promise<Scene> {
  const res = await fetch(`${API}/scenes/${id}`);
  if (!res.ok) throw new Error('Failed to fetch scene');
  return res.json();
}

export async function getUploadUrl(
  filename: string,
  contentType: string,
  token: string
): Promise<{ sceneId: string; uploadUrl: string; key: string }> {
  const res = await fetch(`${API}/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ filename, contentType })
  });
  if (!res.ok) throw new Error('Failed to get upload URL');
  return res.json();
}

export async function createScene(
  data: { sceneId: string; name: string; videoKey: string },
  token: string
): Promise<Scene> {
  const res = await fetch(`${API}/scenes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to create scene');
  return res.json();
}

export async function startProcessing(
  data: { 
    sceneId: string; 
    videoKey: string;
    fps?: number;
    iterations?: number;
    densifyUntilIter?: number;
    densificationInterval?: number;
  },
  token: string
): Promise<{ executionArn: string }> {
  const res = await fetch(`${API}/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to start processing');
  return res.json();
}

export async function deleteScene(id: string, token: string): Promise<void> {
  const res = await fetch(`${API}/scenes/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Failed to delete scene');
}
