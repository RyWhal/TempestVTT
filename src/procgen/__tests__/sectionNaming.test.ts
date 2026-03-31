import { describe, expect, it } from 'vitest';
import type { GeneratedSection } from '../types';
import { generateSectionLabel } from '../engine/sectionNaming';

const createSection = ({
  sectionId,
  sectionKind,
  primaryBiomeId,
}: {
  sectionId: string;
  sectionKind: 'exploration' | 'settlement';
  primaryBiomeId: string;
}) =>
  ({
    sectionId,
    seed: `seed_${sectionId}`,
    sectionKind,
    layoutType: 'clustered_rooms',
    grid: { width: 75, height: 75, tileSizeFt: 5 },
    primaryBiomeId,
    defaultFloorMaterialKey: 'dungeon_stone',
    sectionProfile: null,
    rooms: [],
    connections: [],
    connectors: [],
    entranceRoomIds: [],
    exitRoomIds: [],
  }) satisfies GeneratedSection;

const frontierSettlementNouns = new Set([
  'Bastion',
  'Crossing',
  'Gate',
  'Market',
  'Post',
  'Row',
  'Span',
  'Verge',
  'Watch',
]);

const refugeSettlementNouns = new Set(['Green', 'Hearth', 'Hold', 'Quarter', 'Square', 'Yard']);

const lastWord = (label: string) => {
  const parts = label.split(/\s+/);
  return parts[parts.length - 1] ?? '';
};

describe('sectionNaming', () => {
  it('gives hazardous settlements frontier-sounding names instead of cozy refuge names', () => {
    const labels = Array.from({ length: 10 }, (_, index) =>
      generateSectionLabel({
        worldSeed: 'world_ironbell_042',
        sectionId: `molten_settlement_${index}`,
        section: createSection({
          sectionId: `molten_settlement_${index}`,
          sectionKind: 'settlement',
          primaryBiomeId: 'molten_forge',
        }),
      })
    );

    expect(
      labels.every((label) => {
        return !refugeSettlementNouns.has(lastWord(label));
      })
    ).toBe(true);
    expect(
      labels.some((label) => {
        return frontierSettlementNouns.has(lastWord(label));
      })
    ).toBe(true);
  });

  it('keeps genuinely safe settlements capable of using refuge-style names', () => {
    const labels = Array.from({ length: 10 }, (_, index) =>
      generateSectionLabel({
        worldSeed: 'world_ironbell_042',
        sectionId: `garden_settlement_${index}`,
        section: createSection({
          sectionId: `garden_settlement_${index}`,
          sectionKind: 'settlement',
          primaryBiomeId: 'garden_hold',
        }),
      })
    );

    expect(
      labels.some((label) => {
        return refugeSettlementNouns.has(lastWord(label));
      })
    ).toBe(true);
  });

  it('does not reuse a biome settlement noun as the generated noun for safe settlement biomes', () => {
    const labels = Array.from({ length: 10 }, (_, index) =>
      generateSectionLabel({
        worldSeed: 'world_ironbell_042',
        sectionId: `garden_settlement_${index}`,
        section: createSection({
          sectionId: `garden_settlement_${index}`,
          sectionKind: 'settlement',
          primaryBiomeId: 'garden_hold',
        }),
      })
    );

    expect(labels.every((label) => !label.endsWith(' Hold'))).toBe(true);
  });
});
