import { generateProceduralPixelTexture } from './ProceduralPixelTextureGenerator';
import { stableHash, stableNumber } from './seededHash';
import type {
  ProceduralPixelTextureRecipe,
  ProceduralPixelTextureVariant,
} from './ProceduralPixelTextureTypes';

export interface ProceduralPixelTextureVariantPack {
  cacheKey: string;
  variantPackId: string;
  packSize: number;
  variants: ProceduralPixelTextureVariant[];
}

export interface ProceduralPixelTexturePackRequest {
  recipe: ProceduralPixelTextureRecipe;
  mapSeed: string;
}

export interface ProceduralPixelTextureVariantRequest extends ProceduralPixelTexturePackRequest {
  variantIndex?: number;
  variantSeed?: string;
}

export interface ProceduralPixelTextureCacheApi {
  getOrCreateVariantPack(request: ProceduralPixelTexturePackRequest): ProceduralPixelTextureVariantPack;
  getVariant(request: ProceduralPixelTextureVariantRequest): ProceduralPixelTextureVariant;
}

const createCacheKey = (recipe: ProceduralPixelTextureRecipe, mapSeed: string) =>
  [
    recipe.layer_type,
    recipe.biome_id,
    recipe.recipe_key,
    recipe.tile_size_px,
    recipe.recipe_version,
    mapSeed,
  ].join(':');

const getPackSize = (cacheKey: string) => 4 + Math.floor(stableNumber(`${cacheKey}:pack_size`) * 5);

const getVariantSeed = (cacheKey: string, index: number) => `${cacheKey}:variant:${index}`;

export class ProceduralPixelTextureCache implements ProceduralPixelTextureCacheApi {
  private readonly packs = new Map<string, ProceduralPixelTextureVariantPack>();
  private readonly variantsBySeed = new Map<string, ProceduralPixelTextureVariant>();

  getOrCreateVariantPack({
    recipe,
    mapSeed,
  }: ProceduralPixelTexturePackRequest): ProceduralPixelTextureVariantPack {
    const cacheKey = createCacheKey(recipe, mapSeed);
    const existing = this.packs.get(cacheKey);
    if (existing) {
      return existing;
    }

    const packSize = getPackSize(cacheKey);
    const variants = Array.from({ length: packSize }, (_, index) =>
      generateProceduralPixelTexture({
        recipe,
        variantSeed: getVariantSeed(cacheKey, index),
      })
    );

    const pack: ProceduralPixelTextureVariantPack = {
      cacheKey,
      variantPackId: `procedural-pixel-texture-pack-${stableHash(cacheKey)}`,
      packSize,
      variants,
    };

    this.packs.set(cacheKey, pack);
    return pack;
  }

  getVariant({
    recipe,
    mapSeed,
    variantIndex,
    variantSeed,
  }: ProceduralPixelTextureVariantRequest): ProceduralPixelTextureVariant {
    if (variantSeed !== undefined) {
      const seedCacheKey = `${createCacheKey(recipe, mapSeed)}:seed:${variantSeed}`;
      const existing = this.variantsBySeed.get(seedCacheKey);
      if (existing) {
        return existing;
      }

      const generated = generateProceduralPixelTexture({
        recipe,
        variantSeed,
      });
      this.variantsBySeed.set(seedCacheKey, generated);
      return generated;
    }

    const pack = this.getOrCreateVariantPack({ recipe, mapSeed });
    if (pack.variants.length === 0) {
      throw new Error(`Procedural pixel texture pack ${pack.variantPackId} has no variants`);
    }

    const normalizedIndex = variantIndex === undefined ? 0 : Math.abs(Math.trunc(variantIndex));
    return pack.variants[normalizedIndex % pack.variants.length];
  }
}

export const createProceduralPixelTextureCache = () => new ProceduralPixelTextureCache();
