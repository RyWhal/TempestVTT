import { generateSection } from '../src/procgen/engine/sectionGenerator';
import { buildSemanticMapFromGeneratedSection } from '../src/procgen/bake/GeneratedSectionSemanticAdapter';
import { loadMapBakeContent } from '../src/procgen/bake/AssetRegistryLoader';
import { createVisualRuleResolver } from '../src/procgen/bake/VisualRuleResolver';
import { createTileVariantSelector } from '../src/procgen/bake/TileVariantSelector';
import { createChunkCompositor } from '../src/procgen/bake/ChunkCompositor';
import { buildSectionRenderPayload } from '../src/procgen/map/buildSectionRenderPayload';
import { createTransitionResolver } from '../src/procgen/bake/TransitionResolver';
import { createWallRuleResolver } from '../src/procgen/bake/WallRuleResolver';
import { createWallVariantSelector } from '../src/procgen/bake/WallVariantSelector';
import { createSetDressingResolver } from '../src/procgen/bake/SetDressingResolver';
import { createInlineArtifactWriter } from '../src/procgen/bake/inlineArtifactWriter';

const content = loadMapBakeContent();
const generatedSection = generateSection({
  worldSeed: 'starter_hub_seed',
  sectionId: 'section_hometown',
  sectionKind: 'settlement',
});
const semanticMap = buildSemanticMapFromGeneratedSection(generatedSection);
const renderPayload = buildSectionRenderPayload(generatedSection);
const visualRules = createVisualRuleResolver(content).resolveMapRules(semanticMap);
const selections = createTileVariantSelector(content.pipelineConfig, content.assetRegistry).selectMapFloorTiles({
  semanticMap,
  visualRules,
  configVersion: content.pipelineConfig.schema_version,
});
const transitions = createTransitionResolver(content.pipelineConfig, content.transitionRegistry).resolveTransitions(semanticMap);
const wallRules = createWallRuleResolver(content).resolveWallRules({
  mapSeed: semanticMap.mapSeed,
  walls: renderPayload.walls,
  defaultBiomeId: semanticMap.rooms[0]?.biomeId ?? content.visualMapping.default_biome_id,
});
const wallSelections = createWallVariantSelector(content.pipelineConfig, content.wallRegistry).selectWallSprites({
  mapSeed: semanticMap.mapSeed,
  configVersion: content.pipelineConfig.schema_version,
  walls: renderPayload.walls,
  rules: wallRules,
});
const dressingPlacements = createSetDressingResolver(content).resolvePlacements(semanticMap);
const compositor = createChunkCompositor(content);
const firstSelection = selections[0];
const inspectedChunkX = firstSelection ? Math.floor(firstSelection.cell.x / content.pipelineConfig.render_strategy.floor_cells_per_chunk) : 0;
const inspectedChunkY = firstSelection ? Math.floor(firstSelection.cell.y / content.pipelineConfig.render_strategy.floor_cells_per_chunk) : 0;
const chunk = compositor.composeChunk({
  selections,
  wallSelections,
  dressingPlacements,
  transitions,
  chunkX: inspectedChunkX,
  chunkY: inspectedChunkY,
  renderTileSizePx: renderPayload.tileSizePx,
  chunkImagePath: `debug/chunk_${inspectedChunkX}_${inspectedChunkY}.svg`,
  chunkImageUrl: '',
  fingerprint: 'debug',
});

const uniqueAssetIds = [...new Set(selections.map((selection) => selection.asset.id))];
const categoryCounts = selections.reduce<Record<string, number>>((counts, selection) => {
  counts[selection.category] = (counts[selection.category] ?? 0) + 1;
  return counts;
}, {});
const chunkAssetIds = [...chunk.imageContent.matchAll(/data-asset="([^"]+)"/g)].map((match) => match[1]);
const chunkUniqueAssetIds = [...new Set(chunkAssetIds)];
const writer = createInlineArtifactWriter();
const written = await writer.writeArtifact({
  path: 'debug/chunk.svg',
  body: chunk.imageContent,
  contentType: 'image/svg+xml',
});
const encodedBody = written.publicUrl.split(',')[1] ?? '';
const decodedSvg =
  typeof Buffer !== 'undefined'
    ? Buffer.from(encodedBody, 'base64').toString('utf-8')
    : atob(encodedBody);
const inlinedImageCount = [...decodedSvg.matchAll(/href="data:image\/png;base64,/g)].length;

console.log(JSON.stringify({
  sectionId: generatedSection.sectionId,
  primaryBiomeId: generatedSection.primaryBiomeId,
  inspectedChunkX,
  inspectedChunkY,
  uniqueAssetIds,
  uniqueAssetCount: uniqueAssetIds.length,
  categoryCounts,
  chunkUniqueAssetIds,
  chunkUniqueAssetCount: chunkUniqueAssetIds.length,
  inlinedImageCount,
  firstTenSelections: selections.slice(0, 10).map((selection) => ({
    x: selection.cell.x,
    y: selection.cell.y,
    assetId: selection.asset.id,
    category: selection.category,
    rotationDegrees: selection.rotationDegrees,
  })),
  chunkSnippet: decodedSvg.slice(0, 1200),
}, null, 2));
