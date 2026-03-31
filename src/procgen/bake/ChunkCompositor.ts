import type { LoadedMapBakeContent } from './AssetRegistryLoader';
import { createProceduralPixelTextureCache } from './ProceduralPixelTextureCache';
import { createProceduralPixelTextureRecipeIndex } from './ProceduralPixelTextureRegistry';
import { stableColor } from './seededHash';
import { buildGeneratedWallStamps } from '../render/generatedWallStamps';
import type {
  ChunkBakeResult,
  ResolvedCellTransition,
  SelectedFloorTile,
} from './SemanticMapTypes';
import type { SectionRenderLine } from '../types';

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const buildTileTransform = ({
  x,
  y,
  widthPx,
  heightPx,
  rotationDegrees,
  flipHorizontal,
  flipVertical,
}: {
  x: number;
  y: number;
  widthPx: number;
  heightPx: number;
  rotationDegrees: number;
  flipHorizontal: boolean;
  flipVertical: boolean;
}) => {
  const centerX = x + widthPx / 2;
  const centerY = y + heightPx / 2;
  const scaleX = flipHorizontal ? -1 : 1;
  const scaleY = flipVertical ? -1 : 1;

  return [
    `translate(${centerX} ${centerY})`,
    `rotate(${rotationDegrees})`,
    `scale(${scaleX} ${scaleY})`,
    `translate(${-widthPx / 2} ${-heightPx / 2})`,
  ].join(' ');
};

export const createChunkCompositor = ({
  pipelineConfig,
  proceduralTextureRegistry,
}: LoadedMapBakeContent) => {
  const tileSizePx = pipelineConfig.render_strategy.tile_resolution_px;
  const chunkCellSize = pipelineConfig.render_strategy.floor_cells_per_chunk;
  const chunkSizePx = pipelineConfig.render_strategy.chunk_size_px;
  const proceduralCache = createProceduralPixelTextureCache();
  const recipeIndex = createProceduralPixelTextureRecipeIndex(proceduralTextureRegistry);

  const getRecipeForSelection = (selection: SelectedFloorTile) => {
    const biomeRecipes = recipeIndex.recipesByBiome.get(selection.biomeId);
    if (!biomeRecipes || biomeRecipes.length === 0) {
      return proceduralTextureRegistry.entries[0];
    }

    if (biomeRecipes.length === 1) {
      return biomeRecipes[0];
    }

    return (
      recipeIndex.recipesByBiomeAndKey.get(`${selection.biomeId}:${selection.recipeKey}`) ??
      biomeRecipes[0]
    );
  };

  const encodeBase64 = (value: string) => {
    if (typeof globalThis.btoa === 'function') {
      return globalThis.btoa(value);
    }

    return Buffer.from(value, 'utf8').toString('base64');
  };

  const toInlineSvgDataUrl = (svg: string) => `data:image/svg+xml;base64,${encodeBase64(svg)}`;

  return {
    composeChunk({
      selections,
      transitions,
      wallLines,
      renderTileSizePx,
      mapSeed,
      chunkX,
      chunkY,
      chunkImagePath,
      chunkImageUrl,
      fingerprint,
    }: {
      selections: SelectedFloorTile[];
      transitions: ResolvedCellTransition[];
      wallLines: SectionRenderLine[];
      renderTileSizePx: number;
      mapSeed: string;
      chunkX: number;
      chunkY: number;
      chunkImagePath: string;
      chunkImageUrl: string;
      fingerprint: string;
    }): ChunkBakeResult {
      const minCellX = chunkX * chunkCellSize;
      const minCellY = chunkY * chunkCellSize;
      const maxCellX = minCellX + chunkCellSize - 1;
      const maxCellY = minCellY + chunkCellSize - 1;
      const chunkSelections = selections.filter(
        (selection) =>
          selection.cell.x >= minCellX &&
          selection.cell.x <= maxCellX &&
          selection.cell.y >= minCellY &&
          selection.cell.y <= maxCellY
      );
      const chunkTransitions = transitions.filter(
        (transition) =>
          transition.cell.x >= minCellX &&
          transition.cell.x <= maxCellX &&
          transition.cell.y >= minCellY &&
          transition.cell.y <= maxCellY
      );
      const chunkOriginX = chunkX * chunkSizePx;
      const chunkOriginY = chunkY * chunkSizePx;
      const renderToBakeScale = tileSizePx / renderTileSizePx;

      const variantBySelectionId = new Map(
        chunkSelections.map((selection) => {
          const recipe = getRecipeForSelection(selection);
          const variant = proceduralCache.getVariant({
            recipe,
            mapSeed,
            variantSeed: selection.variantSeed,
          });

          return [selection.variantId, variant] as const;
        })
      );

      const baseRects = chunkSelections
        .map((selection) => {
          const localX = (selection.cell.x - minCellX) * tileSizePx;
          const localY = (selection.cell.y - minCellY) * tileSizePx;
          const variant = variantBySelectionId.get(selection.variantId);
          const assetUrl = variant ? toInlineSvgDataUrl(variant.imageBody) : '';
          const transform = buildTileTransform({
            x: localX,
            y: localY,
            widthPx: tileSizePx,
            heightPx: tileSizePx,
            rotationDegrees: selection.rotationDegrees,
            flipHorizontal: selection.flipHorizontal,
            flipVertical: selection.flipVertical,
          });

          return `<g data-asset="${escapeXml(selection.variantId)}" transform="${transform}"><rect x="0" y="0" width="${tileSizePx}" height="${tileSizePx}" fill="${stableColor(
            selection.variantId
          )}" /><image href="${escapeXml(assetUrl)}" x="0" y="0" width="${tileSizePx}" height="${tileSizePx}" preserveAspectRatio="none" /></g>`;
        })
        .join('');

      const transitionRects = chunkTransitions
        .map((transition) => {
          const localX = (transition.cell.x - minCellX) * tileSizePx;
          const localY = (transition.cell.y - minCellY) * tileSizePx;
          return `<rect x="${localX}" y="${localY}" width="${tileSizePx}" height="${tileSizePx}" fill="${stableColor(
            transition.transition.transitionFamilyId,
            0.35
          )}" />`;
        })
        .join('');

      const wallStampRects = pipelineConfig.environment_layers.baked_wall_stamps_enabled
        ? wallLines
            .flatMap((wall) => buildGeneratedWallStamps(wall))
            .filter(
              (stamp) =>
                stamp.x * renderToBakeScale + (stamp.size * renderToBakeScale) / 2 >= chunkOriginX &&
                stamp.x * renderToBakeScale - (stamp.size * renderToBakeScale) / 2 <= chunkOriginX + chunkSizePx &&
                stamp.y * renderToBakeScale + (stamp.size * renderToBakeScale) / 2 >= chunkOriginY &&
                stamp.y * renderToBakeScale - (stamp.size * renderToBakeScale) / 2 <= chunkOriginY + chunkSizePx
            )
            .map((stamp) => {
              const bakeSize = stamp.size * renderToBakeScale;
              const localX = stamp.x * renderToBakeScale - chunkOriginX;
              const localY = stamp.y * renderToBakeScale - chunkOriginY;

              return `<rect data-wall="${escapeXml(stamp.id)}" x="${localX - bakeSize / 2}" y="${
                localY - bakeSize / 2
              }" width="${bakeSize}" height="${bakeSize}" fill="${escapeXml(
                stamp.fill
              )}" transform="rotate(${stamp.rotation} ${localX} ${localY})" />`;
            })
            .join('')
        : '';

      const imageContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${chunkSizePx}" height="${chunkSizePx}" viewBox="0 0 ${chunkSizePx} ${chunkSizePx}">${baseRects}${transitionRects}${wallStampRects}</svg>`;

      return {
        chunk: {
          chunkX,
          chunkY,
          x: chunkX * chunkSizePx,
          y: chunkY * chunkSizePx,
          widthPx: chunkSizePx,
          heightPx: chunkSizePx,
          imagePath: chunkImagePath,
          imageUrl: chunkImageUrl,
          tileSprites: chunkSelections.map((selection) => ({
            assetId: selection.variantId,
            assetUrl: toInlineSvgDataUrl(
              variantBySelectionId.get(selection.variantId)?.imageBody ?? ''
            ),
            x: (selection.cell.x - minCellX) * tileSizePx,
            y: (selection.cell.y - minCellY) * tileSizePx,
            widthPx: tileSizePx,
            heightPx: tileSizePx,
            rotationDegrees: selection.rotationDegrees,
            flipHorizontal: selection.flipHorizontal,
            flipVertical: selection.flipVertical,
          })),
          transitionOverlays: chunkTransitions.map((transition) => ({
            id: transition.id,
            x: (transition.cell.x - minCellX) * tileSizePx,
            y: (transition.cell.y - minCellY) * tileSizePx,
            widthPx: tileSizePx,
            heightPx: tileSizePx,
            fill: stableColor(transition.transition.transitionFamilyId, 0.35),
          })),
        },
        assetUsage: [
          ...new Set([
            ...chunkSelections.map((selection) => selection.variantId),
          ]),
        ],
        imageContent,
        debugVariantMap: chunkSelections
          .map((selection) => `${selection.cell.x},${selection.cell.y}:${selection.variantId}`)
          .join('\n'),
        debugTransitionMap: chunkTransitions
          .map(
            (transition) =>
              `${transition.cell.x},${transition.cell.y}:${transition.transition.transitionFamilyId}`
          )
          .join('\n'),
        fingerprint,
      };
    },
  };
};
