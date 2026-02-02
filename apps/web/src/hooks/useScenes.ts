import { useQuery } from '@tanstack/react-query';
import { fetchScenes } from '../api/client';

export function useScenes() {
  return useQuery({
    queryKey: ['scenes'],
    queryFn: fetchScenes,
    staleTime: 30000
  });
}
