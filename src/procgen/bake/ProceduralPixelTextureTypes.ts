export const PROCEDURAL_LAYER_TYPES = ['floor', 'wall', 'dressing'] as const;

export type ProceduralLayerType = (typeof PROCEDURAL_LAYER_TYPES)[number];

export interface PixelTexturePaletteEntry {
  color: string;
  weight: number;
}

export interface ProceduralPatternRule {
  color: string;
  weight: number;
  min_size_px?: number;
  max_size_px?: number;
  density?: number;
}

export type ProceduralPatternRules = ProceduralPatternRule[];

export interface ProceduralDirectionalRule {
  axis: 'horizontal' | 'vertical' | 'diagonal';
  intensity: number;
  spacing_px: number;
}

export interface ProceduralVariantCategoryRule {
  category: string;
  weight: number;
}

export interface ProceduralTransformRules {
  rotation_safe: boolean;
  flip_safe: boolean;
}

export type ProceduralBaseFillMode = 'weighted_noise' | 'dominant';

export interface ProceduralPixelTextureRecipe {
  recipe_version: number;
  layer_type: ProceduralLayerType;
  biome_id: string;
  recipe_key: string;
  recipe_weight: number;
  base_fill_mode?: ProceduralBaseFillMode;
  tile_size_px: number;
  pixel_scale: number;
  palette: PixelTexturePaletteEntry[];
  color_weights: Record<string, number>;
  cluster_rules: ProceduralPatternRules;
  accent_rules: ProceduralPatternRules;
  variant_categories: ProceduralVariantCategoryRule[];
  transform_rules: ProceduralTransformRules;
  directional_rules?: ProceduralDirectionalRule[];
}

export interface ProceduralPixelTextureRegistry {
  schema_version: string;
  registry_id: string;
  entries: ProceduralPixelTextureRecipe[];
}

export interface ProceduralPixelTextureVariantMetadata {
  recipeId: string;
  recipeKey: string;
  dominantColors: string[];
  seamSafeEdges: boolean;
}

export interface ProceduralPixelTextureVariant {
  variantId: string;
  variantSeed: string;
  imageContentType: 'image/svg+xml';
  imageBody: string;
  metadata: ProceduralPixelTextureVariantMetadata;
}

export interface ProceduralPixelTextureGenerationOptions {
  recipe: ProceduralPixelTextureRecipe;
  variantSeed: string;
  seamSafeEdges?: boolean;
}
