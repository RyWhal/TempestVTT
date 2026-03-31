import proceduralPixelTextureRegistryRaw from '../../../DunGEN/procedural_pixel_texture_registry.json';
import type {
  PixelTexturePaletteEntry,
  ProceduralBaseFillMode,
  ProceduralDirectionalRule,
  ProceduralLayerType,
  ProceduralPatternRule,
  ProceduralPixelTextureRecipe,
  ProceduralPixelTextureRegistry,
  ProceduralTransformRules,
  ProceduralVariantCategoryRule,
} from './ProceduralPixelTextureTypes';

const PROCEDURAL_LAYER_TYPES: ProceduralLayerType[] = ['floor', 'wall', 'dressing'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const assertString = (value: unknown, path: string): string => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Invalid procedural pixel texture registry: expected ${path} to be a non-empty string`);
  }

  return value;
};

const assertPositiveNumber = (value: unknown, path: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(
      `Invalid procedural pixel texture registry: expected ${path} to be a positive number`
    );
  }

  return value;
};

const assertLayerType = (value: unknown, path: string): ProceduralLayerType => {
  if (typeof value !== 'string' || !PROCEDURAL_LAYER_TYPES.includes(value as ProceduralLayerType)) {
    throw new Error(
      `Invalid procedural pixel texture registry: expected ${path} to be one of ${PROCEDURAL_LAYER_TYPES.join(', ')}`
    );
  }

  return value as ProceduralLayerType;
};

const assertBaseFillMode = (value: unknown, path: string): ProceduralBaseFillMode => {
  if (value !== 'weighted_noise' && value !== 'dominant') {
    throw new Error(
      `Invalid procedural pixel texture registry: expected ${path} to be weighted_noise or dominant`
    );
  }

  return value;
};

const assertPalette = (value: unknown, path: string): PixelTexturePaletteEntry[] => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Invalid procedural pixel texture registry: expected ${path} to be a non-empty array`);
  }

  return value.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`Invalid procedural pixel texture registry: expected ${path}[${index}] to be an object`);
    }

    return {
      color: assertString(entry.color, `${path}[${index}].color`),
      weight: assertPositiveNumber(entry.weight, `${path}[${index}].weight`),
    };
  });
};

const assertPatternRules = (value: unknown, path: string): ProceduralPatternRule[] => {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid procedural pixel texture registry: expected ${path} to be an array`);
  }

  return value.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`Invalid procedural pixel texture registry: expected ${path}[${index}] to be an object`);
    }

    const rule: ProceduralPatternRule = {
      color: assertString(entry.color, `${path}[${index}].color`),
      weight: assertPositiveNumber(entry.weight, `${path}[${index}].weight`),
    };

    if (entry.min_size_px !== undefined) {
      rule.min_size_px = assertPositiveNumber(entry.min_size_px, `${path}[${index}].min_size_px`);
    }

    if (entry.max_size_px !== undefined) {
      rule.max_size_px = assertPositiveNumber(entry.max_size_px, `${path}[${index}].max_size_px`);
    }

    if (entry.density !== undefined) {
      rule.density = assertPositiveNumber(entry.density, `${path}[${index}].density`);
    }

    return rule;
  });
};

const assertDirectionalRules = (value: unknown, path: string): ProceduralDirectionalRule[] => {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`Invalid procedural pixel texture registry: expected ${path} to be an array`);
  }

  return value.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`Invalid procedural pixel texture registry: expected ${path}[${index}] to be an object`);
    }

    const axis = entry.axis;
    if (axis !== 'horizontal' && axis !== 'vertical' && axis !== 'diagonal') {
      throw new Error(
        `Invalid procedural pixel texture registry: expected ${path}[${index}].axis to be horizontal, vertical, or diagonal`
      );
    }

    return {
      axis,
      intensity: assertPositiveNumber(entry.intensity, `${path}[${index}].intensity`),
      spacing_px: assertPositiveNumber(entry.spacing_px, `${path}[${index}].spacing_px`),
    };
  });
};

const assertVariantCategories = (
  value: unknown,
  path: string
): ProceduralVariantCategoryRule[] => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Invalid procedural pixel texture registry: expected ${path} to be a non-empty array`);
  }

  return value.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`Invalid procedural pixel texture registry: expected ${path}[${index}] to be an object`);
    }

    return {
      category: assertString(entry.category, `${path}[${index}].category`),
      weight: assertPositiveNumber(entry.weight, `${path}[${index}].weight`),
    };
  });
};

const assertTransformRules = (value: unknown, path: string): ProceduralTransformRules => {
  if (!isRecord(value)) {
    throw new Error(`Invalid procedural pixel texture registry: expected ${path} to be an object`);
  }

  if (typeof value.rotation_safe !== 'boolean') {
    throw new Error(`Invalid procedural pixel texture registry: expected ${path}.rotation_safe to be a boolean`);
  }

  if (typeof value.flip_safe !== 'boolean') {
    throw new Error(`Invalid procedural pixel texture registry: expected ${path}.flip_safe to be a boolean`);
  }

  return {
    rotation_safe: value.rotation_safe,
    flip_safe: value.flip_safe,
  };
};

const validateRecipe = (value: unknown, index: number): ProceduralPixelTextureRecipe => {
  if (!isRecord(value)) {
    throw new Error(`Invalid procedural pixel texture registry: expected entries[${index}] to be an object`);
  }

  const palette = assertPalette(value.palette, `entries[${index}].palette`);
  const colorWeights = value.color_weights;
  if (!isRecord(colorWeights)) {
    throw new Error(
      `Invalid procedural pixel texture registry: expected entries[${index}].color_weights to be an object`
    );
  }

  for (const entry of palette) {
    const weight = colorWeights[entry.color];
    if (weight === undefined) {
      throw new Error(
        `Invalid procedural pixel texture registry: expected entries[${index}].color_weights to include palette color ${entry.color}`
      );
    }

    assertPositiveNumber(weight, `entries[${index}].color_weights.${entry.color}`);
  }

  const recipe: ProceduralPixelTextureRecipe = {
    recipe_version: assertPositiveNumber(value.recipe_version, `entries[${index}].recipe_version`),
    layer_type: assertLayerType(value.layer_type, `entries[${index}].layer_type`),
    biome_id: assertString(value.biome_id, `entries[${index}].biome_id`),
    recipe_key: assertString(value.recipe_key ?? 'base', `entries[${index}].recipe_key`),
    recipe_weight: assertPositiveNumber(value.recipe_weight ?? 1, `entries[${index}].recipe_weight`),
    base_fill_mode:
      value.base_fill_mode === undefined
        ? 'weighted_noise'
        : assertBaseFillMode(value.base_fill_mode, `entries[${index}].base_fill_mode`),
    tile_size_px: assertPositiveNumber(value.tile_size_px, `entries[${index}].tile_size_px`),
    pixel_scale: assertPositiveNumber(value.pixel_scale, `entries[${index}].pixel_scale`),
    palette,
    color_weights: Object.fromEntries(
      Object.entries(colorWeights).map(([key, rawWeight]) => [assertString(key, `entries[${index}].color_weights key`), assertPositiveNumber(rawWeight, `entries[${index}].color_weights.${key}`)])
    ),
    cluster_rules: assertPatternRules(value.cluster_rules, `entries[${index}].cluster_rules`),
    accent_rules: assertPatternRules(value.accent_rules, `entries[${index}].accent_rules`),
    variant_categories: assertVariantCategories(
      value.variant_categories,
      `entries[${index}].variant_categories`
    ),
    transform_rules: assertTransformRules(
      value.transform_rules,
      `entries[${index}].transform_rules`
    ),
  };

  if (value.directional_rules !== undefined) {
    recipe.directional_rules = assertDirectionalRules(
      value.directional_rules,
      `entries[${index}].directional_rules`
    );
  }

  return recipe;
};

export interface ProceduralPixelTextureRecipeIndex {
  recipesByBiome: Map<string, ProceduralPixelTextureRecipe[]>;
  recipesByBiomeAndKey: Map<string, ProceduralPixelTextureRecipe>;
}

const recipeIndexKey = (biomeId: string, recipeKey: string) => `${biomeId}:${recipeKey}`;

export const createProceduralPixelTextureRecipeIndex = (
  registry: ProceduralPixelTextureRegistry
): ProceduralPixelTextureRecipeIndex => {
  const recipesByBiome = new Map<string, ProceduralPixelTextureRecipe[]>();
  const recipesByBiomeAndKey = new Map<string, ProceduralPixelTextureRecipe>();

  for (const recipe of registry.entries) {
    const biomeRecipes = recipesByBiome.get(recipe.biome_id) ?? [];
    const existing = biomeRecipes.find((entry) => entry.recipe_key === recipe.recipe_key);
    if (existing) {
      throw new Error(
        `Invalid procedural pixel texture registry: duplicate recipe_key ${recipe.recipe_key} for biome ${recipe.biome_id}`
      );
    }

    biomeRecipes.push(recipe);
    recipesByBiome.set(recipe.biome_id, biomeRecipes);
    recipesByBiomeAndKey.set(recipeIndexKey(recipe.biome_id, recipe.recipe_key), recipe);
  }

  for (const [biomeId, recipes] of recipesByBiome.entries()) {
    recipes.sort((left, right) => left.recipe_key.localeCompare(right.recipe_key));
    recipesByBiome.set(biomeId, recipes);
  }

  return {
    recipesByBiome,
    recipesByBiomeAndKey,
  };
};

export const getProceduralPixelTextureRecipe = (
  registry: ProceduralPixelTextureRegistry,
  biomeId: string,
  recipeKey?: string
): ProceduralPixelTextureRecipe | undefined => {
  const index = createProceduralPixelTextureRecipeIndex(registry);
  const recipes = index.recipesByBiome.get(biomeId);
  if (!recipes || recipes.length === 0) {
    return undefined;
  }

  if (recipeKey === undefined) {
    return recipes[0];
  }

  return index.recipesByBiomeAndKey.get(recipeIndexKey(biomeId, recipeKey)) ?? recipes[0];
};

export const validateProceduralPixelTextureRegistry = (
  value: unknown
): ProceduralPixelTextureRegistry => {
  if (!isRecord(value)) {
    throw new Error('Invalid procedural pixel texture registry: expected registry to be an object');
  }

  if (!Array.isArray(value.entries)) {
    throw new Error('Invalid procedural pixel texture registry: expected entries to be an array');
  }

  const entries = value.entries.map((entry, index) => validateRecipe(entry, index));
  const seenRecipeKeys = new Set<string>();
  for (const recipe of entries) {
    const key = recipeIndexKey(recipe.biome_id, recipe.recipe_key);
    if (seenRecipeKeys.has(key)) {
      throw new Error(
        `Invalid procedural pixel texture registry: duplicate recipe_key ${recipe.recipe_key} for biome ${recipe.biome_id}`
      );
    }

    seenRecipeKeys.add(key);
  }

  return {
    schema_version: assertString(value.schema_version, 'schema_version'),
    registry_id: assertString(value.registry_id, 'registry_id'),
    entries,
  };
};

export const loadProceduralPixelTextureRegistry = (): ProceduralPixelTextureRegistry =>
  validateProceduralPixelTextureRegistry(proceduralPixelTextureRegistryRaw);
