import { describe, expect, it } from 'vitest';
import { normalizeContentPack } from '../content/normalizeContentPack';
import type { RawContentPackResult } from '../content/loadContentPack';

describe('normalizeContentPack', () => {
  it('normalizes biome generation profiles from a unified entries array', () => {
    const pack = normalizeContentPack({
      packId: 'biome_generation_profiles',
      filePath: null,
      required: true,
      rawData: {
        entries: [
          {
            id: 'bone_gallery',
            label: 'Bone Gallery',
            allowed_section_kinds: ['exploration'],
            allowed_room_primitive_ids: ['rectangle_medium'],
            room_primitive_density: 0.55,
            allowed_corridor_primitive_ids: ['rectangle_short'],
            corridor_density: 0.7,
            junction_density: 0.25,
            open_space_ratio: 0.2,
            landmark_frequency: 0.15,
            hazard_pressure: 0.6,
            settlement_pressure: 0.05,
            default_floor_material_key: 'dungeon_stone',
            alternate_floor_material_keys: ['messy_stone'],
          },
        ],
      },
    });

    expect(pack.entries).toHaveLength(1);
    expect(pack.entries[0]?.id).toBe('bone_gallery');
  });

  it('normalizes settlement generation profiles from a unified entries array', () => {
    const pack = normalizeContentPack({
      packId: 'settlement_generation_profiles',
      filePath: null,
      required: true,
      rawData: {
        entries: [
          {
            id: 'waystop',
            label: 'Waystop',
            allowed_biomes: ['stone_halls'],
            water_support: 0.45,
            food_support: 0.3,
            safety_modifier: 0.1,
            route_centrality_modifier: 0.9,
            open_space_preference: 0.5,
            primitive_preferences: ['rectangle_medium', 'rectangle_long'],
            minimum_livability_score: 0.2,
            npc_role_weights: { innkeeper: 2, guard: 1 },
            shop_type_weights: { general_merchant: 2 },
            default_floor_material_key: 'dungeon_stone',
          },
        ],
      },
    });

    expect(pack.entries).toHaveLength(1);
    expect(pack.entries[0]?.id).toBe('waystop');
  });

  it('normalizes floor material profiles from a unified entries array', () => {
    const pack = normalizeContentPack({
      packId: 'floor_material_profiles',
      filePath: null,
      required: true,
      rawData: {
        entries: [
          {
            id: 'cobblestone',
            label: 'Cobblestone',
            category: 'stone',
            fallback_material_key: 'dungeon_stone',
            asset_path: '/assets/floors/cobblestone.png',
            variant_asset_paths: ['/assets/floors/cobblestone_variant.png'],
            supports_tiling: true,
          },
        ],
      },
    });

    expect(pack.entries).toHaveLength(1);
    expect(pack.entries[0]?.id).toBe('cobblestone');
  });

  it('normalizes floor transition profiles from a unified entries array', () => {
    const pack = normalizeContentPack({
      packId: 'floor_transition_profiles',
      filePath: null,
      required: true,
      rawData: {
        entries: [
          {
            id: 'ice_to_stone',
            from_material_key: 'ice_floor',
            to_material_key: 'dungeon_stone',
            asset_path: '/assets/floors/transitions/ice_to_stone.png',
            fallback_material_key: 'stone_to_stone',
          },
        ],
      },
    });

    expect(pack.entries).toHaveLength(1);
    expect(pack.entries[0]?.id).toBe('ice_to_stone');
  });

  it('normalizes category-based npc roleplaying entries from a unified entries array', () => {
    const pack = normalizeContentPack({
      packId: 'npc_roleplaying',
      filePath: null,
      required: true,
      rawData: {
        entries: [
          {
            id: 'voice_1',
            category: 'voice',
            text: 'quiet and measured',
            allowed_roles: ['guide'],
            allowed_archetypes: [],
            allowed_settlement_archetypes: [],
            allowed_biomes: [],
            allowed_section_kinds: [],
            allowed_shop_types: [],
            required_shop_roles: [],
            requires_hazard: false,
          },
          {
            id: 'mannerism_1',
            category: 'mannerism',
            text: 'checks the exits first',
            allowed_roles: ['guide'],
            allowed_archetypes: [],
            allowed_settlement_archetypes: [],
            allowed_biomes: [],
            allowed_section_kinds: [],
            allowed_shop_types: [],
            required_shop_roles: [],
            requires_hazard: false,
          },
          {
            id: 'framing_1',
            category: 'framing',
            text: 'cautious until they trust someone',
            allowed_roles: ['guide'],
            allowed_archetypes: [],
            allowed_settlement_archetypes: [],
            allowed_biomes: [],
            allowed_section_kinds: [],
            allowed_shop_types: [],
            required_shop_roles: [],
            requires_hazard: false,
          },
          {
            id: 'pressure_1',
            category: 'current_pressure',
            text: 'treats every route like it might collapse tomorrow',
            allowed_roles: ['guide'],
            allowed_archetypes: [],
            allowed_settlement_archetypes: [],
            allowed_biomes: [],
            allowed_section_kinds: [],
            allowed_shop_types: [],
            required_shop_roles: [],
            requires_hazard: false,
          },
        ],
      },
    } satisfies RawContentPackResult<'npc_roleplaying'>);

    expect(pack.voice).toHaveLength(1);
    expect(pack.mannerisms).toHaveLength(1);
    expect(pack.framing).toHaveLength(1);
    expect(pack.currentPressure).toHaveLength(1);
  });

  it('normalizes category-based npc context entries from a unified entries array', () => {
    const pack = normalizeContentPack({
      packId: 'npc_context_modifiers',
      filePath: null,
      required: true,
      rawData: {
        entries: [
          {
            id: 'needs_1',
            category: 'needs',
            text: 'proof the party can help',
            allowed_roles: ['innkeeper'],
            allowed_archetypes: [],
            allowed_settlement_archetypes: [],
            allowed_biomes: [],
            allowed_section_kinds: [],
            allowed_shop_types: [],
            required_shop_roles: [],
            requires_hazard: false,
          },
          {
            id: 'offers_1',
            category: 'offers',
            text: 'shelter and gossip',
            allowed_roles: ['innkeeper'],
            allowed_archetypes: [],
            allowed_settlement_archetypes: [],
            allowed_biomes: [],
            allowed_section_kinds: [],
            allowed_shop_types: [],
            required_shop_roles: [],
            requires_hazard: false,
          },
        ],
      },
    } satisfies RawContentPackResult<'npc_context_modifiers'>);

    expect(pack.needs).toHaveLength(1);
    expect(pack.offers).toHaveLength(1);
    expect(pack.knows).toHaveLength(0);
    expect(pack.knownFor).toHaveLength(0);
  });

  it('normalizes category-based shop flavor entries from a unified entries array', () => {
    const pack = normalizeContentPack({
      packId: 'shop_flavor_fragments',
      filePath: null,
      required: true,
      rawData: {
        entries: [
          {
            id: 'desc_1',
            category: 'description',
            text: 'Could be a cramped trade room.',
            allowed_roles: [],
            allowed_archetypes: [],
            allowed_settlement_archetypes: ['waystop'],
            allowed_biomes: [],
            allowed_section_kinds: [],
            allowed_shop_types: ['general_merchant'],
            required_shop_roles: [],
            requires_hazard: false,
          },
          {
            id: 'pressure_1',
            category: 'pressure',
            text: 'The keeper may be hiding a shortage.',
            allowed_roles: [],
            allowed_archetypes: [],
            allowed_settlement_archetypes: ['waystop'],
            allowed_biomes: [],
            allowed_section_kinds: [],
            allowed_shop_types: ['general_merchant'],
            required_shop_roles: [],
            requires_hazard: false,
          },
        ],
      },
    } satisfies RawContentPackResult<'shop_flavor_fragments'>);

    expect(pack.descriptions).toHaveLength(1);
    expect(pack.pressures).toHaveLength(1);
  });

  it('normalizes unified section narrative entries', () => {
    const pack = normalizeContentPack({
      packId: 'section_narrative_fragments',
      filePath: null,
      required: true,
      rawData: {
        entries: [
          {
            id: 'intro_1',
            category: 'read_aloud_intro',
            title_template: 'Read Aloud: {section_name}',
            text: '{section_name} feels unstable.',
            summary_text: 'Opening atmosphere.',
            allowed_roles: [],
            allowed_archetypes: [],
            allowed_settlement_archetypes: [],
            allowed_biomes: [],
            allowed_section_kinds: ['exploration'],
            allowed_shop_types: [],
            required_shop_roles: [],
            requires_hazard: false,
          },
        ],
      },
    } satisfies RawContentPackResult<'section_narrative_fragments'>);

    expect(pack.sectionNarrativeFragments).toHaveLength(1);
    expect(pack.sectionNarrativeFragments[0]?.category).toBe('read_aloud_intro');
  });

  it('normalizes unified creature book entries', () => {
    const pack = normalizeContentPack({
      packId: 'creature_book_fragments',
      filePath: null,
      required: true,
      rawData: {
        entries: [
          {
            id: 'creature_1',
            category: 'creature_seed_body',
            title_template: '{creature_name}',
            text: '{creature_name} could show up as pressure.',
            summary_text: '{creature_hook}',
            allowed_roles: [],
            allowed_archetypes: [],
            allowed_settlement_archetypes: [],
            allowed_biomes: [],
            allowed_section_kinds: ['exploration'],
            allowed_shop_types: [],
            required_shop_roles: [],
            requires_hazard: false,
          },
        ],
      },
    } satisfies RawContentPackResult<'creature_book_fragments'>);

    expect(pack.creatureBookFragments).toHaveLength(1);
    expect(pack.creatureBookFragments[0]?.category).toBe('creature_seed_body');
  });
});
