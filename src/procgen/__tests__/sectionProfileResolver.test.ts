import { describe, expect, it } from 'vitest';
import { contentRegistry } from '../content/contentRegistry';
import { resolveSectionProfileFromPacks } from '../engine/sectionProfileResolver';
import type {
  BiomeGenerationProfile,
  SettlementGenerationProfile,
} from '../types';

const createBiomeProfile = (
  overrides: Partial<BiomeGenerationProfile> = {}
): BiomeGenerationProfile => ({
  id: 'safe_hollows',
  label: 'Safe Hollows',
  allowed_section_kinds: ['exploration', 'settlement'],
  allowed_room_primitive_ids: ['rectangle_medium'],
  room_primitive_density: 0.45,
  allowed_corridor_primitive_ids: ['rectangle_short'],
  corridor_density: 0.5,
  junction_density: 0.15,
  open_space_ratio: 0.35,
  landmark_frequency: 0.1,
  hazard_pressure: 0.15,
  settlement_pressure: 0.85,
  default_floor_material_key: 'wood_planks',
  alternate_floor_material_keys: ['dungeon_stone'],
  ...overrides,
});

const createSettlementProfile = (
  overrides: Partial<SettlementGenerationProfile> = {}
): SettlementGenerationProfile => ({
  id: 'garden_hold',
  label: 'Garden Hold',
  allowed_biomes: ['safe_hollows'],
  water_support: 0.8,
  food_support: 0.9,
  safety_modifier: 0.2,
  route_centrality_modifier: 0.35,
  open_space_preference: 0.8,
  primitive_preferences: ['circle_large', 'rectangle_medium'],
  minimum_livability_score: 0.4,
  npc_role_weights: { gardener: 3 },
  shop_type_weights: { herbalist: 2 },
  default_floor_material_key: 'wood_planks',
  ...overrides,
});

describe('sectionProfileResolver', () => {
  it('returns the same resolved profile for the same seed and coordinates', () => {
    const biomeProfiles = contentRegistry.loadPack('biome_generation_profiles').entries;
    const settlementProfiles = contentRegistry.loadPack('settlement_generation_profiles').entries;

    const first = resolveSectionProfileFromPacks({
      worldSeed: 'world_ironbell_042',
      coordinates: { x: 2, y: -1 },
      biomeProfiles,
      settlementProfiles,
    });
    const second = resolveSectionProfileFromPacks({
      worldSeed: 'world_ironbell_042',
      coordinates: { x: 2, y: -1 },
      biomeProfiles,
      settlementProfiles,
    });

    expect(second).toEqual(first);
  });

  it('keeps low-livability coordinates as exploration sections', () => {
    const profile = resolveSectionProfileFromPacks({
      worldSeed: 'world_bleak_001',
      coordinates: { x: 5, y: 5 },
      biomeProfiles: [
        createBiomeProfile({
          id: 'bone_gallery',
          hazard_pressure: 0.98,
          settlement_pressure: 0.01,
          default_floor_material_key: 'messy_stone',
        }),
      ],
      settlementProfiles: [
        createSettlementProfile({
          allowed_biomes: ['bone_gallery'],
          water_support: 0.05,
          food_support: 0.1,
          safety_modifier: -0.35,
          route_centrality_modifier: -0.2,
          minimum_livability_score: 0.45,
          default_floor_material_key: 'dungeon_stone',
        }),
      ],
    });

    expect(profile.sectionKind).toBe('exploration');
    expect(profile.settlementProfileId).toBeNull();
    expect(profile.defaultFloorMaterialKey).toBe('messy_stone');
  });

  it('exposes primitive density settings and settlement material defaults', () => {
    const profile = resolveSectionProfileFromPacks({
      worldSeed: 'world_green_007',
      coordinates: { x: 1, y: 0 },
      biomeProfiles: [createBiomeProfile()],
      settlementProfiles: [createSettlementProfile()],
    });

    expect(profile.sectionKind).toBe('settlement');
    expect(profile.biomeProfileId).toBe('safe_hollows');
    expect(profile.settlementProfileId).toBe('garden_hold');
    expect(profile.defaultFloorMaterialKey).toBe('wood_planks');
    expect(profile.roomPrimitiveDensity).toBeGreaterThan(0);
    expect(profile.corridorDensity).toBeGreaterThan(0);
    expect(profile.junctionDensity).toBeGreaterThan(0);
    expect(profile.allowedRoomPrimitiveIds).toContain('rectangle_medium');
    expect(profile.settlementPrimitivePreferenceIds).toContain('circle_large');
  });

  it('can force a fixed starting settlement profile when requested', () => {
    const profile = resolveSectionProfileFromPacks({
      worldSeed: 'starter_seed',
      coordinates: { x: 0, y: 0 },
      requestedSectionKind: 'settlement',
      forcedSettlementProfileId: 'garden_hold',
      biomeProfiles: [createBiomeProfile()],
      settlementProfiles: [createSettlementProfile()],
    });

    expect(profile.sectionKind).toBe('settlement');
    expect(profile.settlementProfileId).toBe('garden_hold');
    expect(profile.biomeProfileId).toBe('safe_hollows');
  });

  it('keeps forced settlements compatible with allowed biome lists', () => {
    const profile = resolveSectionProfileFromPacks({
      worldSeed: 'starter_seed',
      coordinates: { x: 0, y: 0 },
      requestedSectionKind: 'settlement',
      forcedSettlementProfileId: 'garden_hold',
      biomeProfiles: [
        createBiomeProfile({
          id: 'unsafe_hollows',
          allowed_section_kinds: ['settlement', 'exploration'],
        }),
        createBiomeProfile({
          id: 'safe_hollows',
          allowed_section_kinds: ['settlement', 'exploration'],
        }),
      ],
      settlementProfiles: [createSettlementProfile({ allowed_biomes: ['safe_hollows'] })],
    });

    expect(profile.sectionKind).toBe('settlement');
    expect(profile.settlementProfileId).toBe('garden_hold');
    expect(profile.biomeProfileId).toBe('safe_hollows');
  });

  it('does not honor a forced biome when it conflicts with a forced settlement profile', () => {
    const profile = resolveSectionProfileFromPacks({
      worldSeed: 'starter_seed',
      coordinates: { x: 0, y: 0 },
      requestedSectionKind: 'settlement',
      forcedBiomeProfileId: 'unsafe_hollows',
      forcedSettlementProfileId: 'garden_hold',
      biomeProfiles: [
        createBiomeProfile({
          id: 'unsafe_hollows',
          allowed_section_kinds: ['settlement', 'exploration'],
        }),
        createBiomeProfile({
          id: 'safe_hollows',
          allowed_section_kinds: ['settlement', 'exploration'],
        }),
      ],
      settlementProfiles: [createSettlementProfile({ allowed_biomes: ['safe_hollows'] })],
    });

    expect(profile.sectionKind).toBe('settlement');
    expect(profile.settlementProfileId).toBe('garden_hold');
    expect(profile.biomeProfileId).toBe('safe_hollows');
  });

  it('does not invent a settlement when no settlement profile is compatible with the biome', () => {
    const profile = resolveSectionProfileFromPacks({
      worldSeed: 'world_nomatch_001',
      coordinates: { x: 1, y: 1 },
      biomeProfiles: [
        createBiomeProfile({
          id: 'bone_gallery',
          allowed_section_kinds: ['exploration', 'settlement'],
          settlement_pressure: 0.9,
          hazard_pressure: 0.1,
        }),
      ],
      settlementProfiles: [
        createSettlementProfile({
          id: 'garden_hold',
          allowed_biomes: ['safe_hollows'],
          minimum_livability_score: 0.1,
        }),
      ],
    });

    expect(profile.sectionKind).toBe('exploration');
    expect(profile.settlementProfileId).toBeNull();
  });

  it('treats settlement-friendly biomes as capable of settlements without making every node a settlement', () => {
    const biomeProfiles = [createBiomeProfile()];
    const settlementProfiles = [createSettlementProfile()];

    const first = resolveSectionProfileFromPacks({
      worldSeed: 'world_green_007',
      coordinates: { x: 1, y: 0 },
      biomeProfiles,
      settlementProfiles,
    });
    const second = resolveSectionProfileFromPacks({
      worldSeed: 'world_green_007',
      coordinates: { x: 5, y: 0 },
      biomeProfiles,
      settlementProfiles,
    });

    expect([first.sectionKind, second.sectionKind]).toContain('settlement');
    expect([first.sectionKind, second.sectionKind]).toContain('exploration');
  });
});
