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

  it('returns a typed empty pack for optional content that does not exist yet', () => {
    const pack = contentRegistry.loadPack('room_type_library');

    expect(pack.roomTypes).toEqual([]);
  });
});
