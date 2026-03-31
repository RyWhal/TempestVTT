import { useCallback } from 'react';
import { contentRegistry } from '../procgen/content/contentRegistry';
import type { ProcgenContentPackId, ProcgenContentPackMap } from '../procgen/types';

export const useProcgenContent = () => {
  const loadPack = useCallback(<K extends ProcgenContentPackId>(packId: K): ProcgenContentPackMap[K] => {
    return contentRegistry.loadPack(packId);
  }, []);

  return {
    loadPack,
  };
};
