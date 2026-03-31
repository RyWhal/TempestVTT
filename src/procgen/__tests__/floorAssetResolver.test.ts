import { describe, expect, it } from 'vitest';
import {
  floorAssetResolverConfig,
  resolveFloorAsset,
} from '../render/floorAssetResolver';

describe('floorAssetResolver', () => {
  it('resolves a floor material to registry-style base asset urls when available', () => {
    const resolved = resolveFloorAsset({ materialKey: 'dungeon_stone' });

    expect(resolved.assetUrl).toBe(
      `${floorAssetResolverConfig.r2BaseUrl}/assets/floors/materials/stone_halls/base/01_a.png`
    );
    expect(resolved.fallbackUrls).toEqual([
      `${floorAssetResolverConfig.r2BaseUrl}/assets/floors/materials/stone_halls/base/01_a.png`,
      `${floorAssetResolverConfig.r2BaseUrl}/assets/floors/materials/cobblestone.png`,
    ]);
  });

  it('resolves transition assets to R2 and falls back to the configured material tile on R2', () => {
    const resolved = resolveFloorAsset({
      materialKey: 'wood_planks',
      transitionMaterialKey: 'wood_to_messy_stone',
    });

    expect(resolved.assetUrl).toBe(
      `${floorAssetResolverConfig.r2BaseUrl}/assets/floors/transitions/wood_to_messy_stone.png`
    );
    expect(resolved.fallbackUrls).toEqual([
      `${floorAssetResolverConfig.r2BaseUrl}/assets/floors/materials/wood_planks/base/01_a.png`,
      `${floorAssetResolverConfig.r2BaseUrl}/assets/floors/materials/wood_planks.png`,
    ]);
  });
});
