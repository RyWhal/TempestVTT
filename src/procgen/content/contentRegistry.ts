import { loadContentPack } from './loadContentPack';
import { normalizeContentPack } from './normalizeContentPack';
import type { ProcgenContentPackId, ProcgenContentPackMap } from '../types';

export const contentRegistry = {
  loadPack<K extends ProcgenContentPackId>(packId: K): ProcgenContentPackMap[K] {
    return normalizeContentPack(loadContentPack(packId));
  },
};
