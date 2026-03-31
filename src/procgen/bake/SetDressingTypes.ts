import type { SemanticCell } from './SemanticMapTypes';

export const SET_DRESSING_CATEGORY_IDS = [
  'roots',
  'moss_patches',
  'strewn_stones',
  'garden_patches',
  'crates',
  'tables',
  'beds',
  'bedrolls',
  'barrels',
  'rocks',
] as const;

export type SetDressingCategoryId = (typeof SET_DRESSING_CATEGORY_IDS)[number];

export interface SetDressingAssetVariant {
  id: string;
  path: string;
  weight: number;
}

export interface SetDressingAssetFamily {
  category_id: SetDressingCategoryId;
  asset_family_id: string;
  rotation_safe: boolean;
  flip_safe: boolean;
  assets: {
    base: SetDressingAssetVariant[];
  };
}

export interface SetDressingAssetRegistry {
  schema_version: string;
  registry_id: string;
  categories: SetDressingAssetFamily[];
}

export interface SetDressingRuleEntry {
  biome_id: string;
  categories: SetDressingCategoryId[];
  max_density: number;
  excluded_contexts: string[];
}

export interface SetDressingRules {
  schema_version: string;
  ruleset_id: string;
  entries: SetDressingRuleEntry[];
}

export interface SetDressingPlacement {
  id: string;
  roomId: string;
  roomType: string;
  biomeId: string;
  categoryId: SetDressingCategoryId;
  assetId: string;
  assetPath: string;
  cell: SemanticCell;
  widthCells: number;
  heightCells: number;
  rotationDegrees: number;
  flipHorizontal: boolean;
  flipVertical: boolean;
  visualOnly: true;
}
