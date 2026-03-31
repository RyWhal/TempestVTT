import type { SectionBakedFloorChunk, SectionBakedFloorLayer } from '../types';

export type CellType = 'void' | 'floor';

export interface SemanticCell {
  x: number;
  y: number;
  cellType: CellType;
  roomId: string | null;
  biomeId: string | null;
}

export interface SemanticRoom {
  roomId: string;
  roomType: string;
  biomeId: string;
  dangerLevel: number;
  wearLevel: number;
  moistureLevel: number;
  growthLevel: number;
}

export interface SemanticTransition {
  fromRoomId: string;
  toRoomId: string;
  fromBiomeId: string;
  toBiomeId: string;
  transitionType: string;
}

export interface GeneratedSemanticMap {
  mapId: string;
  mapSeed: string;
  widthCells: number;
  heightCells: number;
  cells: SemanticCell[];
  rooms: SemanticRoom[];
  transitions: SemanticTransition[];
}

export interface TileAssetReference {
  id: string;
  path: string;
  weight: number;
}

export interface WeightedVariantRule {
  variantWeights: Record<string, number>;
  macroOverlayBias?: string[];
  detailBias?: string[];
}

export interface ResolvedBiomeVisualRule {
  biomeId: string;
  roomId: string | null;
  tilesetId: string;
  variantWeights: Record<string, number>;
  macroOverlaySetId?: string;
  detailDecalSetId?: string;
  macroOverlayBias: string[];
  detailBias: string[];
}

export interface SelectedFloorTile {
  cell: SemanticCell;
  biomeId: string;
  recipeKey: string;
  category: string;
  variantId: string;
  variantSeed: string;
  asset: TileAssetReference;
  rotationDegrees: number;
  flipHorizontal: boolean;
  flipVertical: boolean;
}

export interface ResolvedBiomeTransition {
  fromBiomeId: string;
  toBiomeId: string;
  transitionFamilyId: string;
  transitionMode: string;
  blendWeights: {
    from: number;
    to: number;
  };
  preferredAssets: string[];
}

export interface ResolvedCellTransition {
  id: string;
  cell: SemanticCell;
  neighborCell: SemanticCell;
  transition: ResolvedBiomeTransition;
}

export interface ChunkBakeResult {
  chunk: SectionBakedFloorChunk;
  assetUsage: string[];
  imageContent: string;
  debugVariantMap?: string;
  debugTransitionMap?: string;
  fingerprint: string;
}

export interface BakeManifest {
  mapId: string;
  mapSeed: string;
  pipelineVersion: string;
  configVersion: string;
  chunkSizePx: number;
  tileResolutionPx: number;
  bakedChunks: SectionBakedFloorChunk[];
  assetUsage: string[];
  createdAt: string;
}

export type MapBakeJobStatus = 'pending' | 'running' | 'complete' | 'failed';

export interface MapBakeJobState {
  mapId: string;
  mapSeed: string;
  pipelineVersion: string;
  configVersion: string;
  contentSignature: string;
  status: MapBakeJobStatus;
  dirtyChunkKeys: string[];
  completedChunkKeys: string[];
  chunkFingerprints: Record<string, string>;
  bakedFloor: SectionBakedFloorLayer;
  lastCompletedAt: string | null;
  lastError?: string | null;
}

export interface ArtifactWriteInput {
  path: string;
  body: string;
  contentType: string;
}

export interface ArtifactWriteResult {
  path: string;
  publicUrl: string;
  etag?: string;
}

export interface MapBakeArtifactWriter {
  writeArtifact(input: ArtifactWriteInput): Promise<ArtifactWriteResult>;
}

export type BakedFloorChunk = SectionBakedFloorChunk;
