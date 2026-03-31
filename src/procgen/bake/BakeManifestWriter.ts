import type { LoadedMapBakeContent } from './AssetRegistryLoader';
import type { BakeManifest, ChunkBakeResult, GeneratedSemanticMap } from './SemanticMapTypes';

export const createBakeManifestWriter = ({ pipelineConfig }: LoadedMapBakeContent) => ({
  createManifest({
    semanticMap,
    chunkResults,
    createdAt,
  }: {
    semanticMap: GeneratedSemanticMap;
    chunkResults: ChunkBakeResult[];
    createdAt: string;
  }): BakeManifest {
    return {
      mapId: semanticMap.mapId,
      mapSeed: semanticMap.mapSeed,
      pipelineVersion: pipelineConfig.pipeline_id,
      configVersion: pipelineConfig.schema_version,
      chunkSizePx: pipelineConfig.render_strategy.chunk_size_px,
      tileResolutionPx: pipelineConfig.render_strategy.tile_resolution_px,
      bakedChunks: chunkResults.map((result) => result.chunk),
      assetUsage: [...new Set(chunkResults.flatMap((result) => result.assetUsage))].sort(),
      createdAt,
    };
  },
});
