import { getMapBakeContentSignature, type LoadedMapBakeContent } from './AssetRegistryLoader';
import { createBakeManifestWriter } from './BakeManifestWriter';
import { createChunkCompositor } from './ChunkCompositor';
import { stableHash } from './seededHash';
import type { GeneratedSemanticMap, MapBakeArtifactWriter, MapBakeJobState } from './SemanticMapTypes';
import { createTileVariantSelector } from './TileVariantSelector';
import { createTransitionResolver } from './TransitionResolver';
import { createVisualRuleResolver } from './VisualRuleResolver';
import type { SectionRenderPayload } from '../types';

export const createR2ArtifactPath = ({
  mapId,
  pipelineVersion,
  configVersion,
  kind,
  chunkX,
  chunkY,
  extension,
}: {
  mapId: string;
  pipelineVersion: string;
  configVersion: string;
  kind: 'chunk' | 'manifest' | 'variant-map' | 'transition-map';
  chunkX?: number;
  chunkY?: number;
  extension: string;
}): string => {
  const basePath = `generated-floor/${mapId}/${pipelineVersion}/${configVersion}`;

  switch (kind) {
    case 'manifest':
      return `${basePath}/manifest.json`;
    case 'variant-map':
      return `${basePath}/debug/variant_${chunkX ?? 0}_${chunkY ?? 0}.${extension}`;
    case 'transition-map':
      return `${basePath}/debug/transition_${chunkX ?? 0}_${chunkY ?? 0}.${extension}`;
    case 'chunk':
    default:
      return `${basePath}/chunks/chunk_${chunkX ?? 0}_${chunkY ?? 0}.${extension}`;
  }
};

const chunkKey = (chunkX: number, chunkY: number) => `${chunkX}:${chunkY}`;

const getChunkCoordinates = (
  semanticMap: GeneratedSemanticMap,
  floorCellsPerChunk: number
): Array<{ chunkX: number; chunkY: number }> =>
  [
    ...new Map(
      semanticMap.cells
        .filter((cell) => cell.cellType === 'floor')
        .map((cell) => {
          const coordinates = {
            chunkX: Math.floor(cell.x / floorCellsPerChunk),
            chunkY: Math.floor(cell.y / floorCellsPerChunk),
          };

          return [chunkKey(coordinates.chunkX, coordinates.chunkY), coordinates] as const;
        })
    ).values(),
  ].sort((left, right) => left.chunkY - right.chunkY || left.chunkX - right.chunkX);

const getChunkFingerprint = ({
  semanticMap,
  chunkX,
  chunkY,
  configVersion,
  contentSignature,
  floorCellsPerChunk,
}: {
  semanticMap: GeneratedSemanticMap;
  chunkX: number;
  chunkY: number;
  configVersion: string;
  contentSignature: string;
  floorCellsPerChunk: number;
}) => {
  const minCellX = chunkX * floorCellsPerChunk;
  const minCellY = chunkY * floorCellsPerChunk;
  const maxCellX = minCellX + floorCellsPerChunk - 1;
  const maxCellY = minCellY + floorCellsPerChunk - 1;

  const relevantCells = semanticMap.cells
    .filter(
      (cell) =>
        cell.x >= minCellX &&
        cell.x <= maxCellX &&
        cell.y >= minCellY &&
        cell.y <= maxCellY &&
        cell.cellType === 'floor'
    )
    .map((cell) => `${cell.x},${cell.y},${cell.biomeId ?? 'none'},${cell.roomId ?? 'none'}`)
    .sort();

  return stableHash(
    JSON.stringify({
      mapId: semanticMap.mapId,
      mapSeed: semanticMap.mapSeed,
      chunkX,
      chunkY,
      configVersion,
      contentSignature,
      relevantCells,
    })
  );
};

export const createMapBakeOrchestrator = ({
  content,
  artifactWriter,
  now = () => new Date().toISOString(),
}: {
  content: LoadedMapBakeContent;
  artifactWriter: MapBakeArtifactWriter;
  now?: () => string;
}) => {
  const visualRuleResolver = createVisualRuleResolver(content);
  const tileVariantSelector = createTileVariantSelector(
    content.pipelineConfig,
    content.proceduralTextureRegistry
  );
  const transitionResolver = createTransitionResolver(
    content.pipelineConfig,
    content.transitionRegistry
  );
  const chunkCompositor = createChunkCompositor(content);
  const manifestWriter = createBakeManifestWriter(content);
  const floorCellsPerChunk = content.pipelineConfig.render_strategy.floor_cells_per_chunk;
  const contentSignature = getMapBakeContentSignature(content);

  return {
    async runBake({
      semanticMap,
      renderPayload,
      previousState,
      maxChunksPerInvocation,
    }: {
      semanticMap: GeneratedSemanticMap;
      renderPayload?: SectionRenderPayload | null;
      previousState: MapBakeJobState | null;
      maxChunksPerInvocation: number;
    }) {
      const canReusePreviousState =
        previousState !== null &&
        previousState.pipelineVersion === content.pipelineConfig.pipeline_id &&
        previousState.configVersion === content.pipelineConfig.schema_version &&
        previousState.contentSignature === contentSignature;
      const visualRules = visualRuleResolver.resolveMapRules(semanticMap);
      const selections = tileVariantSelector.selectMapFloorTiles({
        semanticMap,
        visualRules,
        configVersion: content.pipelineConfig.schema_version,
      });
      const transitions = transitionResolver.resolveTransitions(semanticMap);
      const chunkCoordinates = getChunkCoordinates(semanticMap, floorCellsPerChunk);
      const nextFingerprints = Object.fromEntries(
        chunkCoordinates.map(({ chunkX, chunkY }) => [
          chunkKey(chunkX, chunkY),
          getChunkFingerprint({
            semanticMap,
            chunkX,
            chunkY,
            configVersion: content.pipelineConfig.schema_version,
            contentSignature,
            floorCellsPerChunk,
          }),
        ])
      );

      const dirtyChunkKeys = chunkCoordinates
        .map(({ chunkX, chunkY }) => chunkKey(chunkX, chunkY))
        .filter((key) =>
          !canReusePreviousState || previousState.chunkFingerprints[key] !== nextFingerprints[key]
        );
      const pendingChunkKeys =
        canReusePreviousState &&
        previousState.status === 'running' &&
        previousState.dirtyChunkKeys.length > 0
          ? previousState.dirtyChunkKeys
          : dirtyChunkKeys;
      const chunkKeysToProcess = pendingChunkKeys.slice(0, maxChunksPerInvocation);

      const existingChunks = new Map(
        canReusePreviousState
          ? previousState.bakedFloor.chunks.map((chunk) => [
              chunkKey(chunk.chunkX, chunk.chunkY),
              chunk,
            ])
          : []
      );
      const chunkResults = [];

      for (const key of chunkKeysToProcess) {
        const [chunkXRaw, chunkYRaw] = key.split(':');
        const chunkX = Number.parseInt(chunkXRaw, 10);
        const chunkY = Number.parseInt(chunkYRaw, 10);
        const imagePath = createR2ArtifactPath({
          mapId: semanticMap.mapId,
          pipelineVersion: content.pipelineConfig.pipeline_id,
          configVersion: content.pipelineConfig.schema_version,
          kind: 'chunk',
          chunkX,
          chunkY,
          extension: content.pipelineConfig.render_strategy.image_format,
        });
        const chunkResult = chunkCompositor.composeChunk({
          selections,
          transitions,
          wallLines: renderPayload?.walls ?? [],
          renderTileSizePx:
            renderPayload?.tileSizePx ?? content.pipelineConfig.render_strategy.tile_resolution_px,
          mapSeed: semanticMap.mapSeed,
          chunkX,
          chunkY,
          chunkImagePath: imagePath,
          chunkImageUrl: '',
          fingerprint: nextFingerprints[key],
        });
        const upload = await artifactWriter.writeArtifact({
          path: imagePath,
          body: chunkResult.imageContent,
          contentType: 'image/svg+xml',
        });
        chunkResult.chunk.imageUrl = upload.publicUrl;
        existingChunks.set(key, chunkResult.chunk);
        chunkResults.push(chunkResult);
      }

      const remainingChunkKeys = pendingChunkKeys.slice(chunkKeysToProcess.length);
      const completedChunkKeys = [
        ...new Set([
          ...((canReusePreviousState ? previousState.completedChunkKeys : []) ?? []).filter(
            (key) => !dirtyChunkKeys.includes(key)
          ),
          ...chunkKeysToProcess,
        ]),
      ].sort();
      const jobStatus = remainingChunkKeys.length > 0 ? 'running' : 'complete';
      const bakedChunks = [...existingChunks.entries()]
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([, chunk]) => chunk);
      const manifest = manifestWriter.createManifest({
        semanticMap,
        chunkResults:
          jobStatus === 'complete'
            ? bakedChunks.map((chunk) => ({
                chunk,
                assetUsage: [],
                imageContent: '',
                fingerprint:
                  nextFingerprints[chunkKey(chunk.chunkX, chunk.chunkY)] ?? stableHash(chunk.imagePath),
              }))
            : chunkResults,
        createdAt: now(),
      });

      if (jobStatus === 'complete') {
        await artifactWriter.writeArtifact({
          path: createR2ArtifactPath({
            mapId: semanticMap.mapId,
            pipelineVersion: content.pipelineConfig.pipeline_id,
            configVersion: content.pipelineConfig.schema_version,
            kind: 'manifest',
            extension: 'json',
          }),
          body: JSON.stringify(manifest, null, 2),
          contentType: 'application/json',
        });
      }

      const jobState: MapBakeJobState = {
        mapId: semanticMap.mapId,
        mapSeed: semanticMap.mapSeed,
        pipelineVersion: content.pipelineConfig.pipeline_id,
        configVersion: content.pipelineConfig.schema_version,
        contentSignature,
        status: jobStatus,
        dirtyChunkKeys: remainingChunkKeys,
        completedChunkKeys,
        chunkFingerprints: nextFingerprints,
        bakedFloor: {
          status: jobStatus,
          chunkSizePx: content.pipelineConfig.render_strategy.chunk_size_px,
          tileResolutionPx: content.pipelineConfig.render_strategy.tile_resolution_px,
          floorCellsPerChunk: content.pipelineConfig.render_strategy.floor_cells_per_chunk,
          chunks: bakedChunks,
        },
        lastCompletedAt:
          jobStatus === 'complete'
            ? now()
            : canReusePreviousState
              ? previousState.lastCompletedAt ?? null
              : null,
        lastError: null,
      };

      return {
        manifest,
        chunkResults,
        changedChunkKeys: dirtyChunkKeys,
        remainingChunkKeys,
        jobState,
      };
    },
  };
};
