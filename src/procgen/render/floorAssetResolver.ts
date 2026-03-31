import { contentRegistry } from '../content/contentRegistry';
import tileAssetRegistry from '../../../DunGEN/tile_asset_registry.json';

const R2_TILESET_BASE_URL =
  'https://pub-fbe52c628e4b4a19bfdb93c208146355.r2.dev';
const DEFAULT_FLOOR_MATERIAL_KEY = 'dungeon_stone';

export const normalizeAssetPath = (assetPath: string) =>
  assetPath.startsWith('/') ? assetPath : `/${assetPath}`;

export const toR2AssetUrl = (assetPath: string) =>
  `${R2_TILESET_BASE_URL}${normalizeAssetPath(assetPath)}`;

const materialProfiles = contentRegistry.loadPack('floor_material_profiles').entries;
const transitionProfiles = contentRegistry.loadPack('floor_transition_profiles').entries;
const registryBaseAssetByAlias = new Map<string, string>(
  [
    ['dungeon_stone', 'stone_halls'],
    ['messy_stone', 'stone_halls'],
    ['cobblestone', 'stone_halls'],
    ['wood_planks', 'garden_hold'],
    ['ice_floor', 'ice_vault'],
  ].flatMap(([materialKey, biomeId]) => {
    const tileset = tileAssetRegistry.biome_tilesets.find((entry) => entry.biome_id === biomeId);
    const baseAssetPath = tileset?.assets.base?.[0]?.path;

    return baseAssetPath ? [[materialKey, baseAssetPath] as const] : [];
  })
);

const materialById = new Map(materialProfiles.map((profile) => [profile.id, profile] as const));
const transitionById = new Map(transitionProfiles.map((profile) => [profile.id, profile] as const));

const resolveMaterialProfile = (materialKey?: string, visited = new Set<string>()) => {
  const requestedKey = materialKey ?? DEFAULT_FLOOR_MATERIAL_KEY;
  const profile = materialById.get(requestedKey);

  if (profile) {
    return profile;
  }

  if (visited.has(requestedKey)) {
    return materialById.get(DEFAULT_FLOOR_MATERIAL_KEY) ?? materialProfiles[0] ?? null;
  }

  visited.add(requestedKey);
  return resolveMaterialProfile(DEFAULT_FLOOR_MATERIAL_KEY, visited);
};

const resolveRegistryBaseAssetPath = (materialKey?: string): string | null => {
  if (!materialKey) {
    return registryBaseAssetByAlias.get(DEFAULT_FLOOR_MATERIAL_KEY) ?? null;
  }

  return registryBaseAssetByAlias.get(materialKey) ?? null;
};

export interface ResolvedFloorAsset {
  materialKey: string;
  assetUrl: string | null;
  fallbackUrls: string[];
  transitionMaterialKey?: string;
}

export const resolveFloorAsset = ({
  materialKey,
  transitionMaterialKey,
}: {
  materialKey?: string;
  transitionMaterialKey?: string;
}): ResolvedFloorAsset => {
  const transitionProfile =
    typeof transitionMaterialKey === 'string' ? transitionById.get(transitionMaterialKey) : null;

  if (transitionProfile) {
    const fallbackProfile = resolveMaterialProfile(transitionProfile.fallback_material_key);
    const fallbackRegistryPath = resolveRegistryBaseAssetPath(fallbackProfile?.id);

    return {
      materialKey: fallbackProfile?.id ?? DEFAULT_FLOOR_MATERIAL_KEY,
      assetUrl: toR2AssetUrl(transitionProfile.asset_path),
      fallbackUrls: [
        fallbackRegistryPath ? toR2AssetUrl(fallbackRegistryPath) : null,
        fallbackProfile ? toR2AssetUrl(fallbackProfile.asset_path) : null,
      ].filter((value, index, items): value is string => Boolean(value) && items.indexOf(value) === index),
      transitionMaterialKey,
    };
  }

  const materialProfile = resolveMaterialProfile(materialKey);
  const fallbackProfile = materialProfile
    ? resolveMaterialProfile(materialProfile.fallback_material_key)
    : null;
  const registryBasePath = resolveRegistryBaseAssetPath(materialProfile?.id);
  const fallbackUrls = [
    registryBasePath ? toR2AssetUrl(registryBasePath) : null,
    fallbackProfile ? toR2AssetUrl(fallbackProfile.asset_path) : null,
  ].filter((value, index, items): value is string => Boolean(value) && items.indexOf(value) === index);

  return {
    materialKey: materialProfile?.id ?? DEFAULT_FLOOR_MATERIAL_KEY,
    assetUrl: registryBasePath
      ? toR2AssetUrl(registryBasePath)
      : materialProfile
        ? toR2AssetUrl(materialProfile.asset_path)
        : null,
    fallbackUrls,
    transitionMaterialKey,
  };
};

export const floorAssetResolverConfig = {
  r2BaseUrl: R2_TILESET_BASE_URL,
};
