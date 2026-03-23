import { describe, expect, it } from 'vitest';
import { normalizeContentPack } from '../content/normalizeContentPack';
import type { RawContentPackResult } from '../content/loadContentPack';

describe('normalizeContentPack', () => {
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
});
