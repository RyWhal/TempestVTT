import { describe, expect, it } from 'vitest';
import { generateSectionContent } from '../engine/sectionContentGenerator';
import type { GeneratedSection } from '../types';

const createGeneratedSection = (primaryBiomeId: string): GeneratedSection => ({
  sectionId: 'section_test',
  seed: 'seed_test',
  sectionKind: 'exploration',
  layoutType: 'central_hub',
  grid: {
    width: 100,
    height: 100,
    tileSizeFt: 5,
  },
  primaryBiomeId,
  defaultFloorMaterialKey: 'ice_floor',
  sectionProfile: null,
  rooms: [],
  connections: [],
  connectors: [],
  entranceRoomIds: [],
  exitRoomIds: [],
});

describe('sectionContentGenerator biome resolution', () => {
  it('uses the dedicated ice vault biome entry instead of falling back to old stone halls', () => {
    const content = generateSectionContent({
      section: createGeneratedSection('ice_vault'),
      sectionName: 'Stone Court',
    });

    expect(content.biomeName).toBe('Ice Vault');
  });
});
