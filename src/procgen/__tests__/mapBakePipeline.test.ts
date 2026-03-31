import { describe, expect, it } from 'vitest';
import { contentRegistry } from '../content/contentRegistry';
import { createStarterCampaignSnapshot } from '../engine/campaignFlow';
import { buildSemanticMapFromGeneratedSection } from '../bake/GeneratedSectionSemanticAdapter';
import {
  createMapBakeOrchestrator,
  createR2ArtifactPath,
} from '../bake/MapBakeOrchestrator';
import { createChunkCompositor } from '../bake/ChunkCompositor';
import {
  MAP_BAKE_RUNTIME_FORMAT_VERSION,
  getMapBakeContentSignature,
  loadMapBakeContent,
  loadMapBakeSampleSemanticMap,
} from '../bake/AssetRegistryLoader';
import { createVisualRuleResolver } from '../bake/VisualRuleResolver';
import { createTileVariantSelector } from '../bake/TileVariantSelector';
import { createTransitionResolver } from '../bake/TransitionResolver';
import type {
  GeneratedSemanticMap,
  MapBakeArtifactWriter,
  SelectedFloorTile,
} from '../bake/SemanticMapTypes';
import type { SectionRenderPayload } from '../types';

const createMemoryWriter = (): MapBakeArtifactWriter & {
  writes: Array<{ path: string; body: string; contentType: string }>;
} => {
  const writes: Array<{ path: string; body: string; contentType: string }> = [];

  return {
    writes,
    async writeArtifact({ path, body, contentType }) {
      writes.push({ path, body, contentType });

      return {
        path,
        publicUrl: `https://r2.example.com/${path}`,
        etag: `etag:${writes.length}`,
      };
    },
  };
};

const createTestSemanticMap = (): GeneratedSemanticMap => loadMapBakeSampleSemanticMap();

const createTestRenderPayload = (): SectionRenderPayload => ({
  width: 42 * 28,
  height: 42 * 28,
  tileSizePx: 28,
  backgroundColor: '#050505',
  floors: [],
  walls: [
    {
      id: 'wall_0',
      points: [28, 28, 196, 28],
      stroke: '#17110b',
      strokeWidth: 6,
      surfaceType: 'wall',
      materialKey: 'stone_wall',
      sourceRoomId: 'room_009',
      biomeId: 'fungal_warrens',
    },
  ],
  markers: [],
  doors: [],
  hazards: [],
  objects: [],
  atmosphere: null,
});

describe('TileVariantSelector', () => {
  it('loads the floor bake registries for the bake content signature', () => {
    const content = loadMapBakeContent() as any;

    expect(content.assetRegistry).toBeDefined();
    expect(content.assetRegistry.biome_tilesets.length).toBeGreaterThan(0);
    expect(content.transitionRegistry).toBeDefined();
  });

  it('loads the procedural texture registry into the bake content signature inputs', () => {
    const content = loadMapBakeContent() as any;

    expect(content.proceduralTextureRegistry).toBeDefined();
    expect(content.proceduralTextureRegistry.entries.length).toBeGreaterThan(0);
    expect(
      content.proceduralTextureRegistry.entries.every((entry: any) => entry.tile_size_px === 128)
    ).toBe(true);
  });

  it('pins the current bake runtime format version so code-driven bake changes force rebakes', () => {
    expect(MAP_BAKE_RUNTIME_FORMAT_VERSION).toBe('floor_only_chunks_v10');
  });

  it('changes the bake content signature when the procedural registry changes', () => {
    const content = loadMapBakeContent() as any;
    const baselineSignature = getMapBakeContentSignature(content);
    const mutated = JSON.parse(JSON.stringify(content));
    mutated.proceduralTextureRegistry = {
      ...mutated.proceduralTextureRegistry,
      registry_id: `${mutated.proceduralTextureRegistry.registry_id}_mutated`,
    };

    expect(getMapBakeContentSignature(mutated)).not.toBe(baselineSignature);
  });

  it('covers every biome generation profile in the bake visual mapping and asset registry', () => {
    const content = loadMapBakeContent();
    const biomeIds = contentRegistry
      .loadPack('biome_generation_profiles')
      .entries.map((profile) => profile.id)
      .sort();
    const mappedBiomes = new Set(content.visualMapping.biome_visual_rules.map((rule) => rule.biome_id));
    const registeredBiomes = new Set(
      content.proceduralTextureRegistry.entries
        .filter((recipe) => recipe.layer_type === 'floor')
        .map((recipe) => recipe.biome_id)
    );

    expect(biomeIds.filter((biomeId) => !mappedBiomes.has(biomeId))).toEqual([]);
    expect(biomeIds.filter((biomeId) => !registeredBiomes.has(biomeId))).toEqual([]);
  });

  it('can select aliased stone halls tiles for garden_hold cells', () => {
    const content = loadMapBakeContent();
    const semanticMap: GeneratedSemanticMap = {
      mapId: 'garden_hold_test',
      mapSeed: 'garden_hold_seed',
      widthCells: 1,
      heightCells: 1,
      cells: [
        {
          x: 0,
          y: 0,
          cellType: 'floor',
          roomId: 'room_1',
          biomeId: 'garden_hold',
        },
      ],
      rooms: [
        {
          roomId: 'room_1',
          roomType: 'settlement_room',
          biomeId: 'garden_hold',
          dangerLevel: 0.2,
          wearLevel: 0.2,
          moistureLevel: 0.2,
          growthLevel: 0.3,
        },
      ],
      transitions: [],
    };
    const visualRules = createVisualRuleResolver(content).resolveMapRules(semanticMap);
    const selector = createTileVariantSelector(content.pipelineConfig, content.proceduralTextureRegistry);

    const selected = selector.selectMapFloorTiles({
      semanticMap,
      visualRules,
      configVersion: content.pipelineConfig.schema_version,
    });

    expect(selected).toHaveLength(1);
    expect(selected[0]?.biomeId).toBe('garden_hold');
    expect((selected[0] as any)?.variantSeed).toEqual(expect.any(String));
    expect((selected[0] as any)?.asset?.path).toMatch(/^procedural:\/\//);
    expect((selected[0] as any)?.asset?.path).not.toContain('assets/floors/');
  });

  it('selects the same tile variants for the same seed and config version', () => {
    const content = loadMapBakeContent();
    const semanticMap = createTestSemanticMap();
    const visualRules = createVisualRuleResolver(content).resolveMapRules(semanticMap);
    const selector = createTileVariantSelector(content.pipelineConfig, content.proceduralTextureRegistry);

    const first = selector.selectMapFloorTiles({
      semanticMap,
      visualRules,
      configVersion: content.pipelineConfig.schema_version,
    });
    const second = selector.selectMapFloorTiles({
      semanticMap,
      visualRules,
      configVersion: content.pipelineConfig.schema_version,
    });

    expect(second).toEqual(first);
  });

  it('uses more than one floor category across a multi-cell map when alternatives exist', () => {
    const content = loadMapBakeContent();
    const semanticMap: GeneratedSemanticMap = {
      mapId: 'uniform_biome_floor_variation',
      mapSeed: 'uniform_biome_floor_variation_seed',
      widthCells: 4,
      heightCells: 4,
      cells: Array.from({ length: 16 }, (_, index) => ({
        x: index % 4,
        y: Math.floor(index / 4),
        cellType: 'floor' as const,
        roomId: 'room_uniform',
        biomeId: 'garden_hold',
      })),
      rooms: [
        {
          roomId: 'room_uniform',
          roomType: 'settlement_room',
          biomeId: 'garden_hold',
          dangerLevel: 0.2,
          wearLevel: 0.2,
          moistureLevel: 0.2,
          growthLevel: 0.3,
        },
      ],
      transitions: [],
    };
    const visualRules = createVisualRuleResolver(content).resolveMapRules(semanticMap);
    const selector = createTileVariantSelector(content.pipelineConfig, content.proceduralTextureRegistry);

    const selected = selector.selectMapFloorTiles({
      semanticMap,
      visualRules,
      configVersion: content.pipelineConfig.schema_version,
    });

    expect(new Set(selected.map((entry) => entry.category)).size).toBeGreaterThan(1);
  });

  it('uses multiple wood floor categories for garden_hold when wear is high', () => {
    const content = loadMapBakeContent();
    const semanticMap: GeneratedSemanticMap = {
      mapId: 'garden_hold_high_wear',
      mapSeed: 'garden_hold_high_wear_seed',
      widthCells: 4,
      heightCells: 4,
      cells: Array.from({ length: 16 }, (_, index) => ({
        x: index % 4,
        y: Math.floor(index / 4),
        cellType: 'floor' as const,
        roomId: 'room_uniform',
        biomeId: 'garden_hold',
      })),
      rooms: [
        {
          roomId: 'room_uniform',
          roomType: 'settlement_room',
          biomeId: 'garden_hold',
          dangerLevel: 0.2,
          wearLevel: 0.9,
          moistureLevel: 0.4,
          growthLevel: 0.3,
        },
      ],
      transitions: [],
    };
    const visualRules = createVisualRuleResolver(content).resolveMapRules(semanticMap);
    const selector = createTileVariantSelector(content.pipelineConfig, content.proceduralTextureRegistry);

    const selected = selector.selectMapFloorTiles({
      semanticMap,
      visualRules,
      configVersion: content.pipelineConfig.schema_version,
    });

    const categories = new Set(selected.map((entry) => entry.category));

    expect(categories.has('base')).toBe(true);
    expect(categories.size).toBeGreaterThan(1);
  });

  it('uses more than one procedural variant id across isolated non-adjacent cells', () => {
    const content = loadMapBakeContent();
    const semanticMap: GeneratedSemanticMap = {
      mapId: 'isolated_cells_variation',
      mapSeed: 'isolated_cells_variation_seed',
      widthCells: 9,
      heightCells: 1,
      cells: [0, 2, 4, 6, 8].map((x) => ({
        x,
        y: 0,
        cellType: 'floor' as const,
        roomId: 'room_uniform',
        biomeId: 'stone_halls',
      })),
      rooms: [
        {
          roomId: 'room_uniform',
          roomType: 'corridor_hub',
          biomeId: 'stone_halls',
          dangerLevel: 0.2,
          wearLevel: 0.2,
          moistureLevel: 0.2,
          growthLevel: 0.1,
        },
      ],
      transitions: [],
    };
    const visualRules = createVisualRuleResolver(content).resolveMapRules(semanticMap);
    const selector = createTileVariantSelector(content.pipelineConfig, content.proceduralTextureRegistry);

    const selected = selector.selectMapFloorTiles({
      semanticMap,
      visualRules,
      configVersion: content.pipelineConfig.schema_version,
    });

    expect(new Set(selected.map((entry) => entry.variantId)).size).toBeGreaterThan(1);
  });

  it('selects a stable procedural recipe variant key per fungal warrens cell', () => {
    const content = loadMapBakeContent();
    const semanticMap: GeneratedSemanticMap = {
      mapId: 'fungal_warrens_recipe_variant_selection',
      mapSeed: 'fungal_warrens_recipe_variant_selection_seed',
      widthCells: 3,
      heightCells: 1,
      cells: [0, 1, 2].map((x) => ({
        x,
        y: 0,
        cellType: 'floor' as const,
        roomId: 'room_fungal',
        biomeId: 'fungal_warrens',
      })),
      rooms: [
        {
          roomId: 'room_fungal',
          roomType: 'cavern',
          biomeId: 'fungal_warrens',
          dangerLevel: 0.3,
          wearLevel: 0.6,
          moistureLevel: 0.8,
          growthLevel: 0.9,
        },
      ],
      transitions: [],
    };
    const visualRules = createVisualRuleResolver(content).resolveMapRules(semanticMap);
    const selector = createTileVariantSelector(content.pipelineConfig, content.proceduralTextureRegistry);

    const first = selector.selectMapFloorTiles({
      semanticMap,
      visualRules,
      configVersion: content.pipelineConfig.schema_version,
    });
    const second = selector.selectMapFloorTiles({
      semanticMap,
      visualRules,
      configVersion: content.pipelineConfig.schema_version,
    });

    expect(first).toEqual(second);
    expect(first.every((entry) => ['base', 'gray_heavy', 'spore_dense'].includes(entry.recipeKey))).toBe(true);
    expect(first.every((entry) => entry.recipeKey.length > 0)).toBe(true);
  });

  it('uses the selected fungal warrens recipe when composing chunk textures', () => {
    const content = loadMapBakeContent();
    const baseSelection: SelectedFloorTile = {
      cell: {
        x: 0,
        y: 0,
        cellType: 'floor',
        roomId: 'room_fungal',
        biomeId: 'fungal_warrens',
      },
      biomeId: 'fungal_warrens',
      recipeKey: 'base',
      category: 'fungal_heavy',
      variantId: 'procedural-fungal_warrens-base-fungal_heavy-test',
      variantSeed: 'fungal_warrens:0:0:fungal_heavy:test',
      asset: {
        id: 'procedural-fungal_warrens-base-fungal_heavy-test',
        path: 'procedural://floor/fungal_warrens/base/fungal_heavy/fungal_warrens:0:0:fungal_heavy:test',
        weight: 1,
      },
      rotationDegrees: 0,
      flipHorizontal: false,
      flipVertical: false,
    };
    const denseSelection: SelectedFloorTile = {
      ...baseSelection,
      recipeKey: 'spore_dense',
      variantId: 'procedural-fungal_warrens-spore_dense-fungal_heavy-test',
      asset: {
        id: 'procedural-fungal_warrens-spore_dense-fungal_heavy-test',
        path: 'procedural://floor/fungal_warrens/spore_dense/fungal_heavy/fungal_warrens:0:0:fungal_heavy:test',
        weight: 1,
      },
    };
    const compositor = createChunkCompositor(content);
    const baseResult = compositor.composeChunk({
      selections: [baseSelection],
      transitions: [],
      wallLines: [],
      renderTileSizePx: 28,
      mapSeed: 'fungal_warrens_recipe_variant_selection_seed',
      chunkX: 0,
      chunkY: 0,
      chunkImagePath: 'generated-floor/test/chunks/chunk_0_0.svg',
      chunkImageUrl: '',
      fingerprint: 'fingerprint-test-base',
    });
    const denseResult = compositor.composeChunk({
      selections: [denseSelection],
      transitions: [],
      wallLines: [],
      renderTileSizePx: 28,
      mapSeed: 'fungal_warrens_recipe_variant_selection_seed',
      chunkX: 0,
      chunkY: 0,
      chunkImagePath: 'generated-floor/test/chunks/chunk_0_0.svg',
      chunkImageUrl: '',
      fingerprint: 'fingerprint-test-dense',
    });

    expect(baseResult.chunk.tileSprites?.[0]?.assetId).not.toBe(
      denseResult.chunk.tileSprites?.[0]?.assetId
    );
    expect(baseResult.assetUsage).toEqual([baseSelection.variantId]);
    expect(denseResult.assetUsage).toEqual([denseSelection.variantId]);
  });

  it('writes baked chunk SVGs that include multiple floor asset ids when variants exist', async () => {
    const content = loadMapBakeContent();
    const semanticMap: GeneratedSemanticMap = {
      mapId: 'garden_hold_chunk_variation',
      mapSeed: 'garden_hold_chunk_variation_seed',
      widthCells: 4,
      heightCells: 4,
      cells: Array.from({ length: 16 }, (_, index) => ({
        x: index % 4,
        y: Math.floor(index / 4),
        cellType: 'floor' as const,
        roomId: 'room_uniform',
        biomeId: 'garden_hold',
      })),
      rooms: [
        {
          roomId: 'room_uniform',
          roomType: 'settlement_room',
          biomeId: 'garden_hold',
          dangerLevel: 0.2,
          wearLevel: 0.8,
          moistureLevel: 0.2,
          growthLevel: 0.1,
        },
      ],
      transitions: [],
    };
    const writer = createMemoryWriter();
    const orchestrator = createMapBakeOrchestrator({
      content,
      artifactWriter: writer,
    });

    await orchestrator.runBake({
      semanticMap,
      renderPayload: {
        ...createTestRenderPayload(),
        width: 4 * 28,
        height: 4 * 28,
        floors: [],
      },
      previousState: null,
      maxChunksPerInvocation: 32,
    });

    const chunkWrite = writer.writes.find((write) => write.contentType === 'image/svg+xml');
    expect(chunkWrite).toBeDefined();

    const assetIds = [...chunkWrite!.body.matchAll(/data-asset="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(assetIds).size).toBeGreaterThan(1);
    expect(chunkWrite!.body).toContain('data-wall="wall_0:stamp:');
  });

  it('keeps adjacent baked wall stamps overlapping after bake-space scaling', () => {
    const content = loadMapBakeContent();
    const compositor = createChunkCompositor(content);

    const result = compositor.composeChunk({
      selections: [],
      transitions: [],
      wallLines: createTestRenderPayload().walls,
      renderTileSizePx: 28,
      mapSeed: 'wall_overlap_seed',
      chunkX: 0,
      chunkY: 0,
      chunkImagePath: 'generated-floor/test/chunks/chunk_0_0.svg',
      chunkImageUrl: '',
      fingerprint: 'wall-overlap-fingerprint',
    });

    const wallMatches = [...result.imageContent.matchAll(/data-wall="wall_0:stamp:(\d+)" x="([^"]+)" y="([^"]+)" width="([^"]+)"/g)];
    const first = wallMatches.find((match) => match[1] === '0');
    const second = wallMatches.find((match) => match[1] === '1');

    expect(first).toBeDefined();
    expect(second).toBeDefined();

    const firstX = Number.parseFloat(first?.[2] ?? '0');
    const secondX = Number.parseFloat(second?.[2] ?? '0');
    const firstWidth = Number.parseFloat(first?.[4] ?? '0');

    expect(secondX - firstX).toBeLessThan(firstWidth);
  });

  it('scales baked wall stamp positions into bake-space instead of leaving them in render-space', () => {
    const content = loadMapBakeContent();
    const compositor = createChunkCompositor(content);

    const result = compositor.composeChunk({
      selections: [],
      transitions: [],
      wallLines: createTestRenderPayload().walls,
      renderTileSizePx: 28,
      mapSeed: 'wall_scale_seed',
      chunkX: 0,
      chunkY: 0,
      chunkImagePath: 'generated-floor/test/chunks/chunk_0_0.svg',
      chunkImageUrl: '',
      fingerprint: 'wall-scale-fingerprint',
    });

    const firstWallRect = result.imageContent.match(/data-wall="wall_0:stamp:0" x="([^"]+)"/);
    expect(firstWallRect).not.toBeNull();
    expect(Number.parseFloat(firstWallRect?.[1] ?? '0')).toBeGreaterThan(40);
  });

  it('writes chunk SVGs with transparent backgrounds so empty chunk space does not tint the map', () => {
    const content = loadMapBakeContent();
    const compositor = createChunkCompositor(content);

    const result = compositor.composeChunk({
      selections: [],
      transitions: [],
      wallLines: [],
      renderTileSizePx: 28,
      mapSeed: 'transparent_chunk_seed',
      chunkX: 0,
      chunkY: 0,
      chunkImagePath: 'generated-floor/test/chunks/chunk_0_0.svg',
      chunkImageUrl: '',
      fingerprint: 'transparent-chunk-fingerprint',
    });

    expect(result.imageContent).not.toContain('fill="#111827"');
  });

  it('keeps wall stamps when the wall belongs to a later chunk in display-space coordinates', () => {
    const content = loadMapBakeContent();
    const compositor = createChunkCompositor(content);

    const result = compositor.composeChunk({
      selections: [],
      transitions: [],
      wallLines: [
        {
          id: 'wall_chunk_1',
          points: [560, 28, 700, 28],
          stroke: '#17110b',
          strokeWidth: 6,
          surfaceType: 'wall',
          materialKey: 'stone_wall',
          sourceRoomId: 'room_010',
          biomeId: 'stone_halls',
        },
      ],
      renderTileSizePx: 28,
      mapSeed: 'wall_chunk_1_seed',
      chunkX: 1,
      chunkY: 0,
      chunkImagePath: 'generated-floor/test/chunks/chunk_1_0.svg',
      chunkImageUrl: '',
      fingerprint: 'wall-chunk-1-fingerprint',
    });

    expect(result.imageContent).toContain('data-wall="wall_chunk_1:stamp:');
  });

  it('selects multiple floor categories for a real generated settlement section', () => {
    const content = loadMapBakeContent();
    const generatedSection =
      createStarterCampaignSnapshot({
        sessionId: 'session_001',
        campaignName: 'The Bloom Beneath',
        worldSeed: 'world_ironbell_042',
      }).sections[0]?.generationState.generatedSection;

    expect(generatedSection).toBeTruthy();
    if (!generatedSection) {
      return;
    }

    const adapted = buildSemanticMapFromGeneratedSection(generatedSection);
    const visualRules = createVisualRuleResolver(content).resolveMapRules(adapted);
    const selector = createTileVariantSelector(content.pipelineConfig, content.proceduralTextureRegistry);

    const selected = selector.selectMapFloorTiles({
      semanticMap: adapted,
      visualRules,
      configVersion: content.pipelineConfig.schema_version,
    });

    expect(selected.length).toBeGreaterThan(0);
    expect(new Set(selected.map((entry) => entry.category)).size).toBeGreaterThan(1);
  });

  it('avoids adjacent identical categories and repeated 2x2 category blocks when alternatives exist', () => {
    const content = loadMapBakeContent();
    const semanticMap = createTestSemanticMap();
    const visualRules = createVisualRuleResolver(content).resolveMapRules(semanticMap);
    const selector = createTileVariantSelector(content.pipelineConfig, content.proceduralTextureRegistry);
    const selected = selector.selectMapFloorTiles({
      semanticMap,
      visualRules,
      configVersion: content.pipelineConfig.schema_version,
    });

    const floorSelections = selected.filter((entry) => entry.cell.cellType === 'floor');
    const byCoordinate = new Map(
      floorSelections.map((entry) => [`${entry.cell.x},${entry.cell.y}`, entry] as const)
    );

    for (const entry of floorSelections) {
      const east = byCoordinate.get(`${entry.cell.x + 1},${entry.cell.y}`);
      const south = byCoordinate.get(`${entry.cell.x},${entry.cell.y + 1}`);

      if (east) {
        expect(east.category).not.toBe(entry.category);
      }

      if (south) {
        expect(south.category).not.toBe(entry.category);
      }

      const southeast = byCoordinate.get(`${entry.cell.x + 1},${entry.cell.y + 1}`);
      if (east && south && southeast) {
        const categories = [entry.category, east.category, south.category, southeast.category];
        expect(new Set(categories).size).toBeGreaterThan(1);
      }
    }
  });
});

describe('TransitionResolver', () => {
  it('prefers declared biome transitions and falls back to the neutral transition when needed', () => {
    const content = loadMapBakeContent();
    const resolver = createTransitionResolver(content.pipelineConfig, content.transitionRegistry);
    const semanticMap = createTestSemanticMap();

    const resolved = resolver.resolveTransitions(semanticMap);

    expect(
      resolved.some((entry) => entry.transition.transitionFamilyId === 'stone_to_fungal')
    ).toBe(true);
    expect(
      resolved.some((entry) => entry.transition.transitionFamilyId === 'neutral_blend_fallback')
    ).toBe(true);
  });
});

describe('MapBakeOrchestrator', () => {
  it('creates deterministic chunk output and a stable manifest for the same inputs', async () => {
    const content = loadMapBakeContent();
    const writer = createMemoryWriter();
    const orchestrator = createMapBakeOrchestrator({
      content,
      artifactWriter: writer,
      now: () => '2026-03-26T00:00:00.000Z',
    });

    const semanticMap = createTestSemanticMap();
    const first = await orchestrator.runBake({
      semanticMap,
      previousState: null,
      maxChunksPerInvocation: 8,
    });
    const second = await orchestrator.runBake({
      semanticMap,
      previousState: null,
      maxChunksPerInvocation: 8,
    });

    expect(second.manifest).toEqual(first.manifest);
    expect(second.chunkResults).toEqual(first.chunkResults);
    expect(first.jobState.contentSignature).toBe(getMapBakeContentSignature(content));
    expect(writer.writes.some((entry) => entry.path.endsWith('/manifest.json'))).toBe(true);
  });

  it('composes baked chunk svg output from inline procedural floor variants', async () => {
    const content = loadMapBakeContent();
    const writer = createMemoryWriter();
    const orchestrator = createMapBakeOrchestrator({
      content,
      artifactWriter: writer,
      now: () => '2026-03-26T00:00:00.000Z',
    });

    await orchestrator.runBake({
      semanticMap: createTestSemanticMap(),
      previousState: null,
      maxChunksPerInvocation: 8,
    });

    const chunkWrite = writer.writes.find(
      (entry) => entry.path.endsWith('/chunk_0_0.svg') && entry.body.includes('<svg')
    );

    expect(chunkWrite).toBeDefined();
    expect(chunkWrite?.body).toContain('<image');
    expect(chunkWrite?.body).toContain('data:image/svg+xml;base64,');
    expect(chunkWrite?.body).not.toContain('procedural://floor/');
    expect(chunkWrite?.body).not.toContain('assets/floors/materials/');
  });

  it('does not emit wall or set dressing sprite metadata in the floor-only bake path', async () => {
    const content = loadMapBakeContent();
    const writer = createMemoryWriter();
    const orchestrator = createMapBakeOrchestrator({
      content,
      artifactWriter: writer,
      now: () => '2026-03-26T00:00:00.000Z',
    });

    const semanticMap: GeneratedSemanticMap = {
      mapId: 'environment_layer_test',
      mapSeed: 'environment_layer_seed',
      widthCells: 6,
      heightCells: 6,
      cells: Array.from({ length: 9 }, (_, index) => ({
        x: index % 3,
        y: Math.floor(index / 3),
        cellType: 'floor' as const,
        roomId: 'room_garden',
        biomeId: 'garden_hold',
      })),
      rooms: [
        {
          roomId: 'room_garden',
          roomType: 'garden_chamber',
          biomeId: 'garden_hold',
          dangerLevel: 0.1,
          wearLevel: 0.2,
          moistureLevel: 0.3,
          growthLevel: 0.4,
        },
      ],
      transitions: [],
    };

    const result = await orchestrator.runBake({
      semanticMap,
      renderPayload: createTestRenderPayload(),
      previousState: null,
      maxChunksPerInvocation: 8,
    });

    const chunks = result.jobState.bakedFloor.chunks;
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.every((chunk) => (chunk.wallSprites?.length ?? 0) === 0)).toBe(true);
    expect(chunks.every((chunk) => (chunk.dressingSprites?.length ?? 0) === 0)).toBe(true);
  });

  it('rebakes only dirty chunks when the semantic map changes locally', async () => {
    const content = loadMapBakeContent();
    const writer = createMemoryWriter();
    const orchestrator = createMapBakeOrchestrator({
      content,
      artifactWriter: writer,
      now: () => '2026-03-26T00:00:00.000Z',
    });

    const initialMap = createTestSemanticMap();
    const initial = await orchestrator.runBake({
      semanticMap: initialMap,
      previousState: null,
      maxChunksPerInvocation: 8,
    });

    const updatedMap: GeneratedSemanticMap = {
      ...initialMap,
      cells: initialMap.cells.map((cell) =>
        cell.x === 20 && cell.y === 10 ? { ...cell, biomeId: 'waterways' } : cell
      ),
    };

    const resumed = await orchestrator.runBake({
      semanticMap: updatedMap,
      previousState: initial.jobState,
      maxChunksPerInvocation: 8,
    });

    expect(resumed.jobState.dirtyChunkKeys).toEqual([]);
    expect(resumed.jobState.completedChunkKeys.length).toBeGreaterThan(0);
    expect(resumed.changedChunkKeys.length).toBeLessThan(initial.jobState.completedChunkKeys.length);
    expect(resumed.changedChunkKeys).toContain('1:0');
  });

  it('supports resumable chunk batches under a bounded invocation budget', async () => {
    const content = loadMapBakeContent();
    const writer = createMemoryWriter();
    const orchestrator = createMapBakeOrchestrator({
      content,
      artifactWriter: writer,
      now: () => '2026-03-26T00:00:00.000Z',
    });

    const semanticMap = createTestSemanticMap();
    const firstPass = await orchestrator.runBake({
      semanticMap,
      previousState: null,
      maxChunksPerInvocation: 1,
    });

    expect(firstPass.jobState.status).toBe('running');
    expect(firstPass.remainingChunkKeys.length).toBeGreaterThan(0);

    const secondPass = await orchestrator.runBake({
      semanticMap,
      previousState: firstPass.jobState,
      maxChunksPerInvocation: 8,
    });

    expect(secondPass.jobState.status).toBe('complete');
    expect(secondPass.remainingChunkKeys).toEqual([]);
  });

  it('invalidates cached chunk fingerprints when the bake content signature changes', async () => {
    const content = loadMapBakeContent();
    const writer = createMemoryWriter();
    const orchestrator = createMapBakeOrchestrator({
      content,
      artifactWriter: writer,
      now: () => '2026-03-26T00:00:00.000Z',
    });

    const semanticMap = createTestSemanticMap();
    const initial = await orchestrator.runBake({
      semanticMap,
      previousState: null,
      maxChunksPerInvocation: 8,
    });

    const resumed = await orchestrator.runBake({
      semanticMap,
      previousState: {
        ...initial.jobState,
        contentSignature: 'stale-signature',
      },
      maxChunksPerInvocation: 8,
    });

    expect(resumed.changedChunkKeys.length).toBe(initial.jobState.completedChunkKeys.length);
    expect(resumed.jobState.contentSignature).toBe(getMapBakeContentSignature(content));
  });
});

describe('artifact path conventions', () => {
  it('uses stable R2 object keys for section floor artifacts', () => {
    expect(
      createR2ArtifactPath({
        mapId: 'run_014_room_008',
        pipelineVersion: 'tempest_visual_bake_v1',
        configVersion: '1.0',
        kind: 'chunk',
        chunkX: 0,
        chunkY: 0,
        extension: 'svg',
      })
    ).toBe(
      'generated-floor/run_014_room_008/tempest_visual_bake_v1/1.0/chunks/chunk_0_0.svg'
    );
  });
});
