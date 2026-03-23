import { describe, expect, it } from 'vitest';
import { contentRegistry } from '../content/contentRegistry';

describe('contentRegistry', () => {
  it('loads creature families from the aliased creatures.json pack', () => {
    const pack = contentRegistry.loadPack('creature_families');

    expect(pack.creatureFamilies.length).toBeGreaterThan(0);
    expect(pack.creatureFamilies.some((family) => family.id === 'sporekin')).toBe(true);
  });

  it('loads creature variants from the aliased creature_variant_modifiers.json pack', () => {
    const pack = contentRegistry.loadPack('creature_variants');

    expect(pack.creatureVariants.length).toBeGreaterThan(0);
    expect(pack.creatureVariants.some((variant) => variant.id === 'glowing')).toBe(true);
  });

  it('loads room primitives from the new room_primitives.json pack', () => {
    const pack = contentRegistry.loadPack('room_primitives');

    expect(pack.roomPrimitives.length).toBeGreaterThan(0);
    expect(pack.roomPrimitives.some((primitive) => primitive.id === 'rectangle_medium')).toBe(true);
  });

  it('loads shop types from the broader shops.json pack', () => {
    const pack = contentRegistry.loadPack('shop_types');

    expect(pack.shopTypes.length).toBeGreaterThan(0);
    expect(pack.shopTypes.some((shopType) => shopType.id === 'general_merchant')).toBe(true);
  });

  it('loads item templates from the new item_tables.json pack', () => {
    const pack = contentRegistry.loadPack('item_tables');

    expect(pack.itemTemplates.length).toBeGreaterThan(0);
    expect(pack.itemTemplates.some((itemTemplate) => itemTemplate.id === 'itm_ration_pack')).toBe(true);
  });

  it('loads shop, encounter, rumor, and hook flavor packs', () => {
    const shopFlavor = contentRegistry.loadPack('shop_flavor_fragments');
    const encounterTemplates = contentRegistry.loadPack('encounter_templates');
    const rumorFragments = contentRegistry.loadPack('rumor_fragments');
    const hookFragments = contentRegistry.loadPack('hook_fragments');

    expect(shopFlavor.descriptions.some((entry) => entry.id === 'merchant_waystop_description')).toBe(true);
    expect(encounterTemplates.encounterTemplates.some((entry) => entry.id === 'settlement_gate_tension')).toBe(true);
    expect(rumorFragments.rumorFragments.some((entry) => entry.id === 'settlement_problem_rumor')).toBe(true);
    expect(hookFragments.hookFragments.some((entry) => entry.id === 'hook_from_npc')).toBe(true);
  });

  it('returns a typed empty pack for optional content that does not exist yet', () => {
    const pack = contentRegistry.loadPack('room_type_library');

    expect(pack.roomTypes).toEqual([]);
  });

  it('loads the new npc flavor packs for archetypes, physical description, roleplay, backstory, and context', () => {
    const archetypes = contentRegistry.loadPack('npc_archetypes');
    const physicalDescriptions = contentRegistry.loadPack('npc_physical_descriptions');
    const roleplaying = contentRegistry.loadPack('npc_roleplaying');
    const backstories = contentRegistry.loadPack('npc_backstory_fragments');
    const context = contentRegistry.loadPack('npc_context_modifiers');

    expect(archetypes.npcArchetypes.some((entry) => entry.id === 'weathered_local')).toBe(true);
    expect(
      physicalDescriptions.npcPhysicalDescriptions.some((entry) => entry.id === 'innkeeper_black_apron')
    ).toBe(true);
    expect(roleplaying.voice.some((entry) => entry.id === 'innkeeper_room_control')).toBe(true);
    expect(
      backstories.npcBackstoryFragments.some((entry) => entry.id === 'innkeeper_common_room_steady')
    ).toBe(true);
    expect(context.needs.some((entry) => entry.id === 'innkeeper_keep_lid_on_it')).toBe(true);
  });
});
