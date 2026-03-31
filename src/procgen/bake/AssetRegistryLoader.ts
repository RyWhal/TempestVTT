import biomeTransitionRegistryRaw from '../../../DunGEN/biome_transition_registry.json';
import sampleSemanticMapRaw from '../../../DunGEN/generated_map_semantic_model.json';
import pipelineConfigRaw from '../../../DunGEN/map_visualization_pipeline_config.json';
import semanticVisualMappingRaw from '../../../DunGEN/semantic_visual_mapping_config.json';
import tileAssetRegistryRaw from '../../../DunGEN/tile_asset_registry.json';
import { loadProceduralPixelTextureRegistry } from './ProceduralPixelTextureRegistry';
import type { GeneratedSemanticMap } from './SemanticMapTypes';
import type { ProceduralPixelTextureRegistry } from './ProceduralPixelTextureTypes';
import { stableHash } from './seededHash';

export interface MapVisualizationPipelineConfig {
  schema_version: string;
  pipeline_id: string;
  render_strategy: {
    chunk_size_px: number;
    tile_resolution_px: number;
    floor_cells_per_chunk: number;
    image_format: string;
  };
  environment_layers: {
    baked_wall_stamps_enabled: boolean;
    baked_grit_enabled: boolean;
  };
  grid_rules: {
    rotation_step_degrees: number;
    allow_rotation: boolean;
    allow_horizontal_flip: boolean;
    allow_vertical_flip: boolean;
  };
  tile_selection_rules: {
    avoid_adjacent_identical_tiles: boolean;
    avoid_2x2_identical_blocks: boolean;
    local_repeat_penalty_radius: number;
    respect_rotation_safety_flags: boolean;
    respect_flip_safety_flags: boolean;
  };
  transition_rules: {
    enabled: boolean;
    fallback_transition_mode: string;
  };
  debug_options: {
    emit_variant_map: boolean;
    emit_transition_map: boolean;
  };
}

export interface SemanticVisualMappingConfig {
  schema_version: string;
  mapping_id: string;
  default_biome_id: string;
  biome_visual_rules: Array<{
    biome_id: string;
    base_tileset_id: string;
    macro_overlay_set_id?: string;
    detail_decal_set_id?: string;
    parameter_mapping: Record<
      string,
      Record<
        string,
        {
          variant_weights?: Record<string, number>;
          macro_overlay_bias?: string[];
          detail_bias?: string[];
        }
      >
    >;
  }>;
}

export interface TileAssetRegistry {
  schema_version: string;
  registry_id: string;
  biome_tilesets: Array<{
    biome_id: string;
    tileset_id: string;
    rotation_safe: boolean;
    flip_safe: boolean;
    assets: Record<string, Array<{ id: string; path: string; weight: number }>>;
  }>;
}

export interface BiomeTransitionRegistry {
  schema_version: string;
  transition_registry_id: string;
  transitions: Array<{
    from_biome_id: string;
    to_biome_id: string;
    transition_family_id: string;
    transition_mode: string;
    blend_weights: {
      from: number;
      to: number;
    };
    preferred_assets: string[];
  }>;
  fallback_transition: {
    transition_family_id: string;
    transition_mode: string;
    blend_weights: {
      from: number;
      to: number;
    };
  };
}

export interface LoadedMapBakeContent {
  pipelineConfig: MapVisualizationPipelineConfig;
  visualMapping: SemanticVisualMappingConfig;
  assetRegistry: TileAssetRegistry;
  transitionRegistry: BiomeTransitionRegistry;
  proceduralTextureRegistry: ProceduralPixelTextureRegistry;
}

export const MAP_BAKE_RUNTIME_FORMAT_VERSION = 'floor_only_chunks_v11';

export const getMapBakeContentSignature = (content: LoadedMapBakeContent): string =>
  stableHash(
    JSON.stringify({
      runtimeFormatVersion: MAP_BAKE_RUNTIME_FORMAT_VERSION,
      pipelineConfig: content.pipelineConfig,
      visualMapping: content.visualMapping,
      assetRegistry: content.assetRegistry,
      transitionRegistry: content.transitionRegistry,
      proceduralTextureRegistry: content.proceduralTextureRegistry,
    })
  );

const toGeneratedSemanticMap = (raw: typeof sampleSemanticMapRaw): GeneratedSemanticMap => ({
  mapId: raw.map_id,
  mapSeed: raw.map_seed,
  widthCells: raw.dimensions.width_cells,
  heightCells: raw.dimensions.height_cells,
  cells: raw.cells.map((cell) => ({
    x: cell.x,
    y: cell.y,
    cellType: cell.cell_type as 'void' | 'floor',
    roomId: cell.room_id,
    biomeId: cell.biome_id,
  })),
  rooms: raw.rooms.map((room) => ({
    roomId: room.room_id,
    roomType: room.room_type,
    biomeId: room.biome_id,
    dangerLevel: room.danger_level,
    wearLevel: room.wear_level,
    moistureLevel: room.moisture_level,
    growthLevel: room.growth_level,
  })),
  transitions: raw.transitions.map((transition) => ({
    fromRoomId: transition.from_room_id,
    toRoomId: transition.to_room_id,
    fromBiomeId: transition.from_biome_id,
    toBiomeId: transition.to_biome_id,
    transitionType: transition.transition_type,
  })),
});

export const loadMapBakeContent = (): LoadedMapBakeContent => ({
  pipelineConfig: pipelineConfigRaw as MapVisualizationPipelineConfig,
  visualMapping: semanticVisualMappingRaw as unknown as SemanticVisualMappingConfig,
  assetRegistry: tileAssetRegistryRaw as unknown as TileAssetRegistry,
  transitionRegistry: biomeTransitionRegistryRaw as unknown as BiomeTransitionRegistry,
  proceduralTextureRegistry: loadProceduralPixelTextureRegistry(),
});

export const loadMapBakeSampleSemanticMap = (): GeneratedSemanticMap =>
  toGeneratedSemanticMap(sampleSemanticMapRaw);
