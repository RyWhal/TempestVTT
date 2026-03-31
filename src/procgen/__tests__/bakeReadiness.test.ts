import { describe, expect, it, vi } from 'vitest';
import { generateSection } from '../engine/sectionGenerator';
import {
  ensureSectionsHaveCurrentBakedFloors,
  sectionHasCurrentBakedFloorCache,
} from '../integration/bakeReadiness';
import type { DungeonSectionRecord } from '../../types';

const createSectionRecord = ({
  contentSignature,
  includeTileSprites = true,
}: {
  contentSignature: string;
  includeTileSprites?: boolean;
}): DungeonSectionRecord => {
  const generatedSection = generateSection({
    worldSeed: 'world_ironbell_042',
    sectionId: 'section_bake_test_001',
    sectionKind: 'exploration',
  });

  return {
    id: 'section_record_001',
    campaignId: 'campaign_001',
    sectionId: generatedSection.sectionId,
    name: 'Bake Test Section',
    state: 'locked',
    primaryBiomeId: generatedSection.primaryBiomeId,
    secondaryBiomeIds: [],
    layoutType: generatedSection.layoutType,
    grid: generatedSection.grid,
    roomIds: generatedSection.rooms.map((room) => room.roomId),
    entranceConnectionIds: generatedSection.entranceRoomIds,
    exitConnectionIds: generatedSection.exitRoomIds,
    generationState: {
      generatedSection,
      coordinates: { x: 0, y: 0 },
      visitIndex: 0,
      enteredFromDirection: null,
      sectionKind: generatedSection.sectionKind,
    },
    presentationState: {},
    overrideState: {},
    renderPayloadCache: {
      bakedFloor: {
        status: 'complete',
        chunkSizePx: 1024,
        tileResolutionPx: 256,
        floorCellsPerChunk: 16,
        chunks: [
          {
            chunkX: 0,
            chunkY: 0,
            x: 0,
            y: 0,
            widthPx: 1024,
            heightPx: 1024,
            imagePath: includeTileSprites ? '' : 'generated/chunk.svg',
            imageUrl: includeTileSprites ? '' : 'https://example.com/generated/chunk.svg',
            tileSprites: includeTileSprites
              ? [
                  {
                    assetId: 'sprite_001',
                    assetUrl: 'data:image/svg+xml;base64,Zm9v',
                    x: 0,
                    y: 0,
                    widthPx: 256,
                    heightPx: 256,
                    rotationDegrees: 0,
                    flipHorizontal: false,
                    flipVertical: false,
                  },
                ]
              : [],
          },
        ],
      },
      bakeJobState: {
        contentSignature,
      },
    },
    lockedAt: null,
    createdAt: '2026-03-30T00:00:00.000Z',
    updatedAt: '2026-03-30T00:00:00.000Z',
  };
};

describe('bakeReadiness', () => {
  it('recognizes a section with a current baked floor cache', () => {
    const section = createSectionRecord({ contentSignature: 'current-signature' });

    expect(sectionHasCurrentBakedFloorCache(section, 'current-signature')).toBe(true);
  });

  it('rebakes sections when the baked floor cache is stale or missing', async () => {
    const staleSection = createSectionRecord({ contentSignature: 'stale-signature' });
    const currentSection = createSectionRecord({ contentSignature: 'current-signature' });
    const bakeSectionFloorCache = vi.fn().mockResolvedValue({
      success: true,
      renderPayloadCache: {
        bakedFloor: {
          status: 'complete',
          chunkSizePx: 1024,
          tileResolutionPx: 256,
          floorCellsPerChunk: 16,
          chunks: [],
        },
        bakeJobState: {
          contentSignature: 'current-signature',
        },
      },
    });

    const result = await ensureSectionsHaveCurrentBakedFloors({
      sections: [staleSection, currentSection],
      expectedContentSignature: 'current-signature',
      bakeSectionFloorCache,
    });

    expect(bakeSectionFloorCache).toHaveBeenCalledTimes(1);
    expect(bakeSectionFloorCache).toHaveBeenCalledWith(staleSection);
    expect(result[0]?.renderPayloadCache).toEqual({
      bakedFloor: {
        status: 'complete',
        chunkSizePx: 1024,
        tileResolutionPx: 256,
        floorCellsPerChunk: 16,
        chunks: [],
      },
      bakeJobState: {
        contentSignature: 'current-signature',
      },
    });
    expect(result[1]).toBe(currentSection);
  });
});
