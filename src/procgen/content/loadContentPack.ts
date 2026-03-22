import { contentManifest } from './contentManifest';
import type { ProcgenContentPackId } from '../types';

export interface RawContentPackResult<K extends ProcgenContentPackId = ProcgenContentPackId> {
  packId: K;
  filePath: string | null;
  required: boolean;
  rawData: unknown;
}

export const loadContentPack = <K extends ProcgenContentPackId>(
  packId: K
): RawContentPackResult<K> => {
  const entry = contentManifest[packId];

  return {
    packId,
    filePath: entry?.filePath ?? null,
    required: entry?.required ?? false,
    rawData: entry?.rawData,
  };
};
