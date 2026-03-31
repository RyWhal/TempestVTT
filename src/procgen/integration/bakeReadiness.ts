import type { DungeonSectionRecord } from '../../types';

export const hasRenderableBakedChunks = (bakedFloor: unknown): boolean => {
  if (!bakedFloor || typeof bakedFloor !== 'object') {
    return false;
  }

  const chunks = (bakedFloor as { chunks?: Array<Record<string, unknown>> }).chunks;
  if (!Array.isArray(chunks) || chunks.length === 0) {
    return false;
  }

  return chunks.some(
    (chunk) =>
      (typeof chunk.imageUrl === 'string' && chunk.imageUrl.length > 0) ||
      (Array.isArray(chunk.tileSprites) && chunk.tileSprites.length > 0)
  );
};

export const sectionHasCurrentBakedFloorCache = (
  section: Pick<DungeonSectionRecord, 'renderPayloadCache'>,
  expectedContentSignature: string
) => {
  const cache = section.renderPayloadCache;
  const bakedFloor = cache && typeof cache === 'object' ? cache.bakedFloor : null;
  const bakeJobState = cache && typeof cache === 'object' ? cache.bakeJobState : null;
  const matchesCurrentBakeContent =
    bakeJobState &&
    typeof bakeJobState === 'object' &&
    (bakeJobState as { contentSignature?: string }).contentSignature === expectedContentSignature;

  return (
    bakedFloor &&
    typeof bakedFloor === 'object' &&
    (bakedFloor as { status?: string }).status === 'complete' &&
    matchesCurrentBakeContent &&
    hasRenderableBakedChunks(bakedFloor)
  );
};

export const ensureSectionsHaveCurrentBakedFloors = async ({
  sections,
  expectedContentSignature,
  bakeSectionFloorCache,
}: {
  sections: DungeonSectionRecord[];
  expectedContentSignature: string;
  bakeSectionFloorCache: (
    section: DungeonSectionRecord
  ) => Promise<
    | { success: true; renderPayloadCache: Record<string, unknown>; persistenceError?: string }
    | { success: false; error: string }
  >;
}) =>
  Promise.all(
    sections.map(async (section) => {
      if (sectionHasCurrentBakedFloorCache(section, expectedContentSignature)) {
        return section;
      }

      const baked = await bakeSectionFloorCache(section);
      if (!baked.success) {
        return section;
      }

      return {
        ...section,
        renderPayloadCache: baked.renderPayloadCache,
      };
    })
  );
