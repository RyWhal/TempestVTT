import { describe, expect, it } from 'vitest';
import { loadProceduralPixelTextureRegistry } from '../bake/ProceduralPixelTextureRegistry';
import { createProceduralPixelTextureCache } from '../bake/ProceduralPixelTextureCache';

describe('ProceduralPixelTextureCache', () => {
  const registry = loadProceduralPixelTextureRegistry();
  const stoneHalls = registry.entries.find((recipe) => recipe.biome_id === 'stone_halls');
  const gardenHold = registry.entries.find((recipe) => recipe.biome_id === 'garden_hold');

  it('reuses the same variant pack for the same recipe and map seed', () => {
    expect(stoneHalls).toBeDefined();

    const cache = createProceduralPixelTextureCache();
    const first = cache.getOrCreateVariantPack({
      recipe: stoneHalls!,
      mapSeed: 'seed-alpha',
    });
    const second = cache.getOrCreateVariantPack({
      recipe: stoneHalls!,
      mapSeed: 'seed-alpha',
    });

    expect(first).toBe(second);
    expect(first.variantPackId).toBe(second.variantPackId);
    expect(first.variants.map((variant) => variant.variantId)).toEqual(
      second.variants.map((variant) => variant.variantId)
    );
  });

  it('builds a bounded variant pack size for a biome and seed', () => {
    expect(gardenHold).toBeDefined();

    const cache = createProceduralPixelTextureCache();
    const pack = cache.getOrCreateVariantPack({
      recipe: gardenHold!,
      mapSeed: 'seed-beta',
    });

    expect(pack.variants.length).toBeGreaterThanOrEqual(4);
    expect(pack.variants.length).toBeLessThanOrEqual(8);
    expect(
      pack.variants.every(
        (variant) =>
          variant.metadata.recipeId ===
          `${gardenHold!.biome_id}:${gardenHold!.recipe_key}:${gardenHold!.recipe_version}`
      )
    ).toBe(true);
    expect(pack.variants.every((variant) => variant.metadata.recipeKey === gardenHold!.recipe_key)).toBe(true);
  });

  it('returns different variant packs for different map seeds', () => {
    expect(stoneHalls).toBeDefined();

    const cache = createProceduralPixelTextureCache();
    const first = cache.getOrCreateVariantPack({
      recipe: stoneHalls!,
      mapSeed: 'seed-alpha',
    });
    const second = cache.getOrCreateVariantPack({
      recipe: stoneHalls!,
      mapSeed: 'seed-beta',
    });

    expect(first.variantPackId).not.toBe(second.variantPackId);
    expect(first.variants.map((variant) => variant.variantId)).not.toEqual(
      second.variants.map((variant) => variant.variantId)
    );
  });

  it('returns the requested variant from a generated pack', () => {
    expect(stoneHalls).toBeDefined();

    const cache = createProceduralPixelTextureCache();
    const pack = cache.getOrCreateVariantPack({
      recipe: stoneHalls!,
      mapSeed: 'seed-gamma',
    });

    const variant = cache.getVariant({
      recipe: stoneHalls!,
      mapSeed: 'seed-gamma',
      variantIndex: 1,
    });

    expect(variant.variantId).toBe(pack.variants[1]?.variantId);
    expect(variant.variantSeed).toBe(pack.variants[1]?.variantSeed);
  });

  it('uses the explicit variant seed to generate unique cached variants instead of collapsing onto a tiny shared pack', () => {
    expect(gardenHold).toBeDefined();

    const cache = createProceduralPixelTextureCache();
    const variants = Array.from({ length: 12 }, (_, index) =>
      cache.getVariant({
        recipe: gardenHold!,
        mapSeed: 'seed-delta',
        variantSeed: `cell-seed-${index}`,
      })
    );

    expect(new Set(variants.map((variant) => variant.variantId)).size).toBe(12);
  });
});
