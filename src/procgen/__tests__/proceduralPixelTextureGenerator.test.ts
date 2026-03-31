import { describe, expect, it } from 'vitest';
import { contentRegistry } from '../content/contentRegistry';
import { generateProceduralPixelTexture } from '../bake/ProceduralPixelTextureGenerator';
import {
  loadProceduralPixelTextureRegistry,
  validateProceduralPixelTextureRegistry,
} from '../bake/ProceduralPixelTextureRegistry';
import type {
  PixelTexturePaletteEntry,
  ProceduralDirectionalRule,
  ProceduralPatternRule,
  ProceduralPixelTextureRecipe,
} from '../bake/ProceduralPixelTextureTypes';
import { PROCEDURAL_LAYER_TYPES } from '../bake/ProceduralPixelTextureTypes';

const registry = loadProceduralPixelTextureRegistry();

describe('ProceduralPixelTextureRegistry', () => {
  it('loads floor recipes for every current biome generation profile', () => {
    const biomeIds = contentRegistry
      .loadPack('biome_generation_profiles')
      .entries.map((profile) => profile.id)
      .sort();

    expect(PROCEDURAL_LAYER_TYPES).toEqual(['floor', 'wall', 'dressing']);
    expect(registry.schema_version).toBe('procedural_pixel_texture_registry_v1');
    expect(registry.registry_id).toBe('default_procedural_pixel_textures');
    const registryBiomes = [...new Set(registry.entries.map((recipe) => recipe.biome_id))].sort();
    expect(registryBiomes).toEqual([...biomeIds, 'stone_halls', 'waterways'].sort());
    expect(registry.entries.some((recipe) => recipe.biome_id === 'stone_halls')).toBe(true);
    expect(registry.entries.some((recipe) => recipe.biome_id === 'waterways')).toBe(true);
    expect(new Set(registry.entries.map((recipe) => recipe.layer_type))).toEqual(new Set(['floor']));

    for (const recipe of registry.entries) {
      expect(recipe.layer_type).toBe('floor');
      expect(recipe.tile_size_px).toBe(128);
      expect(recipe.palette.length).toBeGreaterThan(0);
      expect(recipe.palette.every((entry) => entry.weight > 0)).toBe(true);
      expect(recipe.palette.every((entry) => entry.color.length > 0)).toBe(true);
      expect(Object.values(recipe.color_weights).every((weight) => weight > 0)).toBe(true);
      expect(recipe.cluster_rules.length).toBeGreaterThan(0);
      expect(recipe.accent_rules.length).toBeGreaterThan(0);
      expect(recipe.variant_categories.length).toBeGreaterThan(0);
      expect(recipe.variant_categories.every((entry) => entry.weight > 0)).toBe(true);
      expect(typeof recipe.recipe_key).toBe('string');
      expect(recipe.recipe_key.length).toBeGreaterThan(0);
      expect(typeof recipe.transform_rules.rotation_safe).toBe('boolean');
      expect(typeof recipe.transform_rules.flip_safe).toBe('boolean');
    }
  });

  it('rejects malformed registry structures with clear errors', () => {
    expect(() =>
      validateProceduralPixelTextureRegistry({
        schema_version: 'broken',
        registry_id: 'broken',
        entries: [
          {
            recipe_version: 1,
            layer_type: 'floor',
            biome_id: 'broken_biome',
            tile_size_px: 128,
            pixel_scale: 4,
            palette: [{ color: '#111111', weight: 0 }],
            color_weights: { '#111111': 0 },
            cluster_rules: [],
            accent_rules: [],
          },
        ],
      })
    ).toThrowError(
      'Invalid procedural pixel texture registry: expected entries[0].palette[0].weight to be a positive number'
    );
  });

  it('uses the requested fungal warrens palette and weighting emphasis', () => {
    const fungalWarrens = registry.entries.find(
      (recipe) => recipe.biome_id === 'fungal_warrens' && recipe.recipe_key === 'base'
    );

    expect(fungalWarrens).toBeDefined();
    expect(fungalWarrens?.palette).toEqual([
      { color: '#5E645A', weight: 0.8 },
      { color: '#6A7A52', weight: 0.08 },
      { color: '#4B3F36', weight: 0.04 },
      { color: '#8C9A6B', weight: 0.06 },
      { color: '#C2B89A', weight: 0.02 },
    ]);
    expect(fungalWarrens?.cluster_rules).toEqual([
      { color: '#6A7A52', weight: 0.58, min_size_px: 12, max_size_px: 28, density: 0.58 },
      { color: '#8C9A6B', weight: 0.48, min_size_px: 10, max_size_px: 24, density: 0.46 },
    ]);
    expect(fungalWarrens?.accent_rules).toEqual([
      { color: '#4B3F36', weight: 0.24, min_size_px: 1, max_size_px: 2, density: 0.08 },
      { color: '#C2B89A', weight: 0.18, min_size_px: 1, max_size_px: 2, density: 0.06 },
    ]);
    expect(fungalWarrens?.directional_rules ?? []).toEqual([]);
  });

  it('normalizes the non-fungal biome recipes onto the dominant clustered floor pattern', () => {
    const expectedPalettes: Record<string, Array<{ color: string; weight: number }>> = {
      stone_halls: [
        { color: '#6B6F72', weight: 0.78 },
        { color: '#4F5356', weight: 0.08 },
        { color: '#8A8176', weight: 0.07 },
        { color: '#5C5248', weight: 0.04 },
        { color: '#3F4A3F', weight: 0.03 },
      ],
      garden_hold: [
        { color: '#5A6B3C', weight: 0.78 },
        { color: '#3F4F2A', weight: 0.08 },
        { color: '#7A6E4B', weight: 0.07 },
        { color: '#A3A07A', weight: 0.04 },
        { color: '#2F3A22', weight: 0.03 },
      ],
      bone_gallery: [
        { color: '#D8D2C4', weight: 0.78 },
        { color: '#BFB7A4', weight: 0.08 },
        { color: '#8E8676', weight: 0.07 },
        { color: '#5C564B', weight: 0.04 },
        { color: '#3A342D', weight: 0.03 },
      ],
      slime_cavern: [
        { color: '#3A4A3F', weight: 0.78 },
        { color: '#2E3B33', weight: 0.08 },
        { color: '#4F6F5B', weight: 0.07 },
        { color: '#7FBF7A', weight: 0.04 },
        { color: '#A3BFA6', weight: 0.03 },
      ],
      ice_vault: [
        { color: '#3A4A3F', weight: 0.78 },
        { color: '#2E3B33', weight: 0.08 },
        { color: '#4F6F5B', weight: 0.07 },
        { color: '#7FBF7A', weight: 0.04 },
        { color: '#A3BFA6', weight: 0.03 },
      ],
      molten_forge: [
        { color: '#2B2B2B', weight: 0.78 },
        { color: '#1A1A1A', weight: 0.08 },
        { color: '#3F2A22', weight: 0.07 },
        { color: '#FF6A2A', weight: 0.04 },
        { color: '#FFC16A', weight: 0.03 },
      ],
      waterways: [
        { color: '#5F6A6F', weight: 0.78 },
        { color: '#3F4A4F', weight: 0.08 },
        { color: '#7A8C92', weight: 0.07 },
        { color: '#4E5F4A', weight: 0.04 },
        { color: '#8C7A5A', weight: 0.03 },
      ],
    };

    for (const [biomeId, expectedPalette] of Object.entries(expectedPalettes)) {
      const recipe = registry.entries.find(
        (entry) => entry.biome_id === biomeId && (entry.recipe_key ?? 'base') === 'base'
      );

      expect(recipe, biomeId).toBeDefined();
      expect(recipe?.base_fill_mode ?? 'weighted').toBe('dominant');
      expect(recipe?.pixel_scale).toBe(8);
      expect(recipe?.directional_rules ?? []).toEqual([]);
      expect(recipe?.palette).toEqual(expectedPalette);
      expect(recipe?.cluster_rules.length).toBe(2);
      expect(recipe?.accent_rules.length).toBe(2);
    }
  });

  it('supports multiple fungal warrens floor recipe variants with stable keys', () => {
    const fungalWarrensRecipes = registry.entries.filter(
      (recipe) => recipe.layer_type === 'floor' && recipe.biome_id === 'fungal_warrens'
    );
    const baseRecipe = fungalWarrensRecipes.find((recipe) => recipe.recipe_key === 'base');
    const grayHeavyRecipe = fungalWarrensRecipes.find((recipe) => recipe.recipe_key === 'gray_heavy');
    const sporeDenseRecipe = fungalWarrensRecipes.find((recipe) => recipe.recipe_key === 'spore_dense');

    expect(fungalWarrensRecipes.length).toBeGreaterThan(1);
    expect(fungalWarrensRecipes.map((recipe) => recipe.recipe_key).sort()).toEqual([
      'base',
      'gray_heavy',
      'spore_dense',
    ]);
    expect(baseRecipe).toBeDefined();
    expect(grayHeavyRecipe).toBeDefined();
    expect(sporeDenseRecipe).toBeDefined();
    expect(grayHeavyRecipe!.palette[0]!.weight).toBeGreaterThan(baseRecipe!.palette[0]!.weight);
    expect(sporeDenseRecipe!.palette[0]!.weight).toBeLessThan(baseRecipe!.palette[0]!.weight);
  });

  it('keeps fungal growth adjacency from being diagonal-dominant', () => {
    const fungalRecipes = registry.entries.filter((recipe) => recipe.biome_id === 'fungal_warrens');

    for (const fungalRecipe of fungalRecipes) {
      const generated = generateProceduralPixelTexture({
        recipe: fungalRecipe,
        variantSeed: `diag-adjacency-check:${fungalRecipe.recipe_key}`,
      });
      const grid = getGridFromSvg(
        generated.imageBody,
        fungalRecipe.tile_size_px,
        fungalRecipe.pixel_scale
      );
      const growthColors = fungalRecipe.cluster_rules.map((rule) => rule.color);
      const { orthogonalAdjacency, diagonalAdjacency } = measureAdjacencyForColors(
        grid,
        growthColors
      );

      expect(diagonalAdjacency).toBeLessThanOrEqual(orthogonalAdjacency);
    }
  });

  it('keeps fungal floor recipes coarse enough to survive downscaling to map tiles', () => {
    const fungalRecipes = registry.entries.filter((recipe) => recipe.biome_id === 'fungal_warrens');

    expect(fungalRecipes.length).toBeGreaterThan(0);
    expect(
      fungalRecipes.every((recipe) => recipe.tile_size_px / recipe.pixel_scale <= 16)
    ).toBe(true);
  });

  it('does not bias sparse patch centers onto the same diagonal', () => {
    const sparseBaseRecipe = createValidGeneratorRecipe(
      registry.entries.find((recipe) => recipe.biome_id === 'stone_halls')!
    );
    const sparsePatchRecipe: ProceduralPixelTextureRecipe = {
      ...createWeightTestRecipe(sparseBaseRecipe),
      tile_size_px: 128,
      pixel_scale: 16,
      base_fill_mode: 'dominant',
      palette: [
        { color: '#5e645a', weight: 0.9 },
        { color: '#6a7a52', weight: 0.1 },
      ],
      color_weights: {
        '#5e645a': 0.9,
        '#6a7a52': 0.1,
      },
      cluster_rules: [
        {
          color: '#6a7a52',
          weight: 1,
          density: 1,
          min_size_px: 16,
          max_size_px: 16,
        },
      ],
      accent_rules: [],
      directional_rules: [],
    };

    const generated = generateProceduralPixelTexture({
      recipe: sparsePatchRecipe,
      variantSeed: 'sparse-diagonal-check',
    });
    const grid = getGridFromSvg(
      generated.imageBody,
      sparsePatchRecipe.tile_size_px,
      sparsePatchRecipe.pixel_scale
    );
    const greenCells = getCellsForColor(grid, '#6a7a52');
    const nearMainDiagonal = greenCells.filter(({ x, y }) => Math.abs(x - y) <= 1).length;

    expect(greenCells.length).toBeGreaterThan(0);
    expect(nearMainDiagonal / greenCells.length).toBeLessThan(0.5);
  });
});

describe('ProceduralPixelTextureGenerator', () => {
  const gardenHold = registry.entries.find((recipe) => recipe.biome_id === 'garden_hold');
  const stoneHalls = registry.entries.find((recipe) => recipe.biome_id === 'stone_halls');
  const validGardenHold = createValidGeneratorRecipe(gardenHold!);
  const validStoneHalls = createValidGeneratorRecipe(stoneHalls!);
  const directionalTestRecipe = createDirectionalTestRecipe(validGardenHold);
  const weightTestRecipe = createWeightTestRecipe(validStoneHalls);

  it('is deterministic for the same recipe and seed', () => {
    expect(gardenHold).toBeDefined();

    const first = generateProceduralPixelTexture({
      recipe: validGardenHold,
      variantSeed: 'seed-a',
    });
    const second = generateProceduralPixelTexture({
      recipe: validGardenHold,
      variantSeed: 'seed-a',
    });

    expect(first).toEqual(second);
    expect(first.imageContentType).toBe('image/svg+xml');
    expect(first.metadata.recipeId).toBe('garden_hold:base:2');
    expect(first.metadata.seamSafeEdges).toBe(false);
  });

  it('changes output when the variant seed changes', () => {
    expect(stoneHalls).toBeDefined();

    const first = generateProceduralPixelTexture({
      recipe: validStoneHalls,
      variantSeed: 'seed-a',
    });
    const second = generateProceduralPixelTexture({
      recipe: validStoneHalls,
      variantSeed: 'seed-b',
    });

    expect(first.imageBody).not.toBe(second.imageBody);
    expect(first.variantId).not.toBe(second.variantId);
  });

  it('only uses colors from the configured palette', () => {
    expect(stoneHalls).toBeDefined();

    const generated = generateProceduralPixelTexture({
      recipe: validStoneHalls,
      variantSeed: 'palette-check',
    });
    const palette = new Set(
      validStoneHalls.palette.map((entry: PixelTexturePaletteEntry) => entry.color.toLowerCase())
    );
    const fills = [...generated.imageBody.matchAll(/fill="(#[0-9a-fA-F]{6})"/g)].map((match) =>
      match[1].toLowerCase()
    );

    expect(fills.length).toBeGreaterThan(0);
    expect(fills.every((color) => palette.has(color))).toBe(true);
  });

  it('supports a dominant base fill mode for calmer tiles under overlays', () => {
    const dominantBaseRecipe: ProceduralPixelTextureRecipe = {
      ...weightTestRecipe,
      palette: [
        { color: '#5e645a', weight: 0.9 },
        { color: '#6a7a52', weight: 0.1 },
      ],
      color_weights: {
        '#5e645a': 0.9,
        '#6a7a52': 0.1,
      },
      cluster_rules: [],
      accent_rules: [],
      directional_rules: [],
      base_fill_mode: 'dominant',
    };

    const generated = generateProceduralPixelTexture({
      recipe: dominantBaseRecipe,
      variantSeed: 'dominant-base-check',
    });
    const fills = [...generated.imageBody.matchAll(/fill="(#[0-9a-fA-F]{6})"/g)].map((match) =>
      match[1].toLowerCase()
    );

    expect(new Set(fills)).toEqual(new Set(['#5e645a']));
  });

  it('applies directional grain when explicitly enabled', () => {
    const paletteColors = directionalTestRecipe.palette.map((entry: PixelTexturePaletteEntry) =>
      entry.color.toLowerCase()
    );
    const baseColor = paletteColors[0] ?? '#000000';
    const stripeColor = paletteColors[1] ?? baseColor;
    const directionalOnlyRecipe = {
      ...directionalTestRecipe,
      color_weights: {
        [baseColor]: 1,
        [stripeColor]: 0.0001,
      },
      cluster_rules: [],
      accent_rules: [],
      directional_rules: [
        {
          axis: 'horizontal',
          intensity: 0.9,
          spacing_px: 8,
        } satisfies ProceduralDirectionalRule,
      ],
    };
    const horizontal = generateProceduralPixelTexture({
      recipe: directionalOnlyRecipe,
      variantSeed: 'grain-check',
    });
    const withoutDirectional = generateProceduralPixelTexture({
      recipe: {
        ...directionalOnlyRecipe,
        directional_rules: [],
      },
      variantSeed: 'grain-check',
    });

    const horizontalStripeCount = countColor(horizontal.imageBody, stripeColor);
    const noDirectionalStripeCount = countColor(withoutDirectional.imageBody, stripeColor);

    expect(horizontal.imageBody).not.toBe(withoutDirectional.imageBody);
    expect(horizontalStripeCount).toBeGreaterThan(noDirectionalStripeCount);
  });

  it('reconciles opposite edges when seam-safe mode is enabled', () => {
    const generated = generateProceduralPixelTexture({
      recipe: validGardenHold,
      variantSeed: 'seam-check',
      seamSafeEdges: true,
    });
    const grid = getGridFromSvg(generated.imageBody, validGardenHold.tile_size_px, validGardenHold.pixel_scale);

    for (let x = 0; x < grid.length; x += 1) {
      expect(grid[0][x]).toBe(grid[grid.length - 1][x]);
    }

    for (let y = 0; y < grid.length - 1; y += 1) {
      expect(grid[y][0]).toBe(grid[y][grid.length - 1]);
    }
    expect(grid[grid.length - 1][grid.length - 1]).toBe(grid[0][0]);
    expect(generated.metadata.seamSafeEdges).toBe(true);
  });

  it('gives weight a deterministic effect on patch coverage', () => {
    const lowWeightRecipe = createWeightedGeneratorRecipe(weightTestRecipe, 0.1);
    const highWeightRecipe = createWeightedGeneratorRecipe(weightTestRecipe, 0.95);

    const lowWeight = generateProceduralPixelTexture({
      recipe: lowWeightRecipe,
      variantSeed: 'weight-check',
    });
    const highWeight = generateProceduralPixelTexture({
      recipe: highWeightRecipe,
      variantSeed: 'weight-check',
    });

    const lowCount = countColor(lowWeight.imageBody, lowWeightRecipe.cluster_rules[0].color);
    const highCount = countColor(highWeight.imageBody, highWeightRecipe.cluster_rules[0].color);

    expect(highCount).toBeGreaterThan(lowCount);
    expect(lowWeight).not.toEqual(highWeight);
  });

  it('allows density 0 to disable a patch rule', () => {
    const disabledDensityRecipe = {
      ...weightTestRecipe,
      cluster_rules: [
        {
          ...weightTestRecipe.cluster_rules[0],
          density: 0,
        },
      ],
    };
    const enabledDensityRecipe = {
      ...weightTestRecipe,
      cluster_rules: [
        {
          ...weightTestRecipe.cluster_rules[0],
          density: 1,
        },
      ],
    };

    const disabled = generateProceduralPixelTexture({
      recipe: disabledDensityRecipe,
      variantSeed: 'density-check',
    });
    const enabled = generateProceduralPixelTexture({
      recipe: enabledDensityRecipe,
      variantSeed: 'density-check',
    });

    const disabledCount = countColor(disabled.imageBody, disabledDensityRecipe.cluster_rules[0].color);
    const enabledCount = countColor(enabled.imageBody, enabledDensityRecipe.cluster_rules[0].color);

    expect(enabledCount).toBeGreaterThanOrEqual(disabledCount);
    expect(enabledCount).toBeGreaterThan(disabledCount);
  });

  it('renders growth islands as irregular blobs instead of full rectangles', () => {
    const blobRecipe = {
      ...weightTestRecipe,
      tile_size_px: 64,
      pixel_scale: 4,
      palette: [
        { color: '#5e645a', weight: 0.8 },
        { color: '#6a7a52', weight: 0.2 },
      ],
      color_weights: {
        '#5e645a': 1,
        '#6a7a52': 0,
      },
      cluster_rules: [
        {
          color: '#6a7a52',
          weight: 1,
          density: 0.04,
          min_size_px: 24,
          max_size_px: 24,
        },
      ],
      accent_rules: [],
      directional_rules: [],
    };

    const generated = generateProceduralPixelTexture({
      recipe: blobRecipe,
      variantSeed: 'blob-check',
    });

    const patchCellCount = countColor(generated.imageBody, '#6a7a52');
    const grid = getGridFromSvg(generated.imageBody, blobRecipe.tile_size_px, blobRecipe.pixel_scale);
    const largestBlob = largestConnectedRegion(
      grid,
      '#6a7a52'
    );
    const endpointCount = countRegionEndpoints(grid, '#6a7a52');
    const compactness = measureRegionCompactness(grid, '#6a7a52');

    expect(patchCellCount).toBeGreaterThan(0);
    expect(patchCellCount).toBeLessThan(36);
    expect(largestBlob).toBe(patchCellCount);
    expect(endpointCount).toBeLessThanOrEqual(5);
    expect(compactness).toBeGreaterThan(0.45);
  });

  it('rejects rule colors that are not part of the palette', () => {
    expect(() =>
      generateProceduralPixelTexture({
        recipe: {
          ...weightTestRecipe,
          cluster_rules: [
            {
              ...weightTestRecipe.cluster_rules[0],
              color: '#ffffff',
            },
          ],
        },
        variantSeed: 'invalid-rule-color',
      })
    ).toThrowError('uses non-palette color #ffffff in cluster/accent rule 0');
  });
});

const createValidGeneratorRecipe = (recipe: NonNullable<typeof registry.entries[number]>) => {
  const paletteColors = recipe.palette.map((entry: PixelTexturePaletteEntry) => entry.color.toLowerCase());
  const fallbackColor = paletteColors[0];

  return {
    ...recipe,
    cluster_rules: recipe.cluster_rules.map((rule: ProceduralPatternRule, index: number) => ({
      ...rule,
      color: paletteColors[Math.min(index + 1, paletteColors.length - 1)] ?? fallbackColor,
    })),
    accent_rules: recipe.accent_rules.map((rule: ProceduralPatternRule) => ({
      ...rule,
      color: fallbackColor,
    })),
  };
};

const createDirectionalTestRecipe = (
  recipe: ReturnType<typeof createValidGeneratorRecipe>
): ProceduralPixelTextureRecipe => {
  const paletteColors = recipe.palette.map((entry: PixelTexturePaletteEntry) => entry.color.toLowerCase());
  const baseColor = paletteColors[0];
  const clusterColor = paletteColors[1] ?? paletteColors[0];
  const accentColor = paletteColors[2] ?? paletteColors[0];

  return {
    ...recipe,
    color_weights: {
      [baseColor]: 0.42,
      [clusterColor]: 0.36,
      [accentColor]: 0.22,
    },
    cluster_rules: [
      {
        ...recipe.cluster_rules[0],
        color: clusterColor,
        weight: 0.42,
        density: 0.28,
        min_size_px: 8,
        max_size_px: 20,
      },
    ],
    accent_rules: [
      {
        ...recipe.accent_rules[0],
        color: accentColor,
        weight: 0.58,
        density: 0.08,
        min_size_px: 1,
        max_size_px: 3,
      },
    ],
  };
};

const createWeightTestRecipe = (
  recipe: ReturnType<typeof createValidGeneratorRecipe>
): ProceduralPixelTextureRecipe => {
  const paletteColors = recipe.palette.map((entry: PixelTexturePaletteEntry) => entry.color.toLowerCase());
  const baseColor = paletteColors[0];
  const patchColor = paletteColors[1] ?? paletteColors[0];

  return {
    ...recipe,
    palette: recipe.palette.slice(0, 2),
    color_weights: {
      [baseColor]: 0.84,
      [patchColor]: 0.16,
    },
    cluster_rules: [
      {
        ...recipe.cluster_rules[0],
        color: patchColor,
        weight: 0.4,
        density: 0.24,
      },
    ],
    accent_rules: [],
    directional_rules: [],
  };
};

const createWeightedGeneratorRecipe = (
  recipe: ReturnType<typeof createValidGeneratorRecipe>,
  weight: number
) => ({
  ...recipe,
  cluster_rules: recipe.cluster_rules.map((rule: ProceduralPatternRule, index: number) => ({
    ...rule,
    weight: index === 0 ? weight : rule.weight,
  })),
});

const getGridFromSvg = (svg: string, tileSizePx: number, pixelScale: number) => {
  const cellsPerSide = tileSizePx / pixelScale;
  const cells: string[][] = Array.from({ length: cellsPerSide }, () => Array(cellsPerSide).fill(''));
  const rectPattern = /<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)" fill="(#[0-9a-fA-F]{6})"\s*\/>/g;

  for (const match of svg.matchAll(rectPattern)) {
    const x = Number(match[1]) / pixelScale;
    const y = Number(match[2]) / pixelScale;
    cells[y][x] = match[5].toLowerCase();
  }

  return cells;
};

const countColor = (svg: string, color: string) =>
  [...svg.matchAll(new RegExp(`fill="${color.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'gi'))].length;

const largestConnectedRegion = (cells: string[][], color: string) => {
  const target = color.toLowerCase();
  const visited = new Set<string>();
  let largest = 0;

  const visit = (startX: number, startY: number) => {
    const queue: Array<[number, number]> = [[startX, startY]];
    let size = 0;

    while (queue.length > 0) {
      const [x, y] = queue.shift()!;
      const key = `${x},${y}`;
      if (visited.has(key)) {
        continue;
      }

      visited.add(key);
      if (cells[y]?.[x]?.toLowerCase() !== target) {
        continue;
      }

      size += 1;
      queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    return size;
  };

  for (let y = 0; y < cells.length; y += 1) {
    for (let x = 0; x < cells[y]!.length; x += 1) {
      if (cells[y]![x]!.toLowerCase() !== target || visited.has(`${x},${y}`)) {
        continue;
      }

      largest = Math.max(largest, visit(x, y));
    }
  }

  return largest;
};

const countRegionEndpoints = (cells: string[][], color: string) => {
  const target = color.toLowerCase();
  let endpoints = 0;

  for (let y = 0; y < cells.length; y += 1) {
    for (let x = 0; x < cells[y]!.length; x += 1) {
      if (cells[y]![x]!.toLowerCase() !== target) {
        continue;
      }

      let neighbors = 0;
      if (cells[y]?.[x + 1]?.toLowerCase() === target) neighbors += 1;
      if (cells[y]?.[x - 1]?.toLowerCase() === target) neighbors += 1;
      if (cells[y + 1]?.[x]?.toLowerCase() === target) neighbors += 1;
      if (cells[y - 1]?.[x]?.toLowerCase() === target) neighbors += 1;

      if (neighbors <= 1) {
        endpoints += 1;
      }
    }
  }

  return endpoints;
};

const measureRegionCompactness = (cells: string[][], color: string) => {
  const target = color.toLowerCase();
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let count = 0;

  for (let y = 0; y < cells.length; y += 1) {
    for (let x = 0; x < cells[y]!.length; x += 1) {
      if (cells[y]![x]!.toLowerCase() !== target) {
        continue;
      }

      count += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (count === 0) {
    return 0;
  }

  const boundingArea = (maxX - minX + 1) * (maxY - minY + 1);
  return count / boundingArea;
};

const measureAdjacencyForColors = (cells: string[][], colors: string[]) => {
  const targetColors = new Set(colors.map((color) => color.toLowerCase()));
  let orthogonalAdjacency = 0;
  let diagonalAdjacency = 0;

  for (let y = 0; y < cells.length; y += 1) {
    for (let x = 0; x < cells[y]!.length; x += 1) {
      if (!targetColors.has(cells[y]![x]!.toLowerCase())) {
        continue;
      }

      if (targetColors.has(cells[y]?.[x + 1]?.toLowerCase() ?? '')) {
        orthogonalAdjacency += 1;
      }
      if (targetColors.has(cells[y + 1]?.[x]?.toLowerCase() ?? '')) {
        orthogonalAdjacency += 1;
      }
      if (targetColors.has(cells[y + 1]?.[x + 1]?.toLowerCase() ?? '')) {
        diagonalAdjacency += 1;
      }
      if (targetColors.has(cells[y + 1]?.[x - 1]?.toLowerCase() ?? '')) {
        diagonalAdjacency += 1;
      }
    }
  }

  return {
    orthogonalAdjacency,
    diagonalAdjacency,
  };
};

const getCellsForColor = (cells: string[][], color: string) => {
  const target = color.toLowerCase();
  const matches: Array<{ x: number; y: number }> = [];

  for (let y = 0; y < cells.length; y += 1) {
    for (let x = 0; x < cells[y]!.length; x += 1) {
      if (cells[y]![x]!.toLowerCase() === target) {
        matches.push({ x, y });
      }
    }
  }

  return matches;
};
