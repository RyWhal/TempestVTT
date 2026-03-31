import type { Map } from '../../types';
import { getOrderedVisitedSections, type CampaignSnapshot } from '../engine/campaignFlow';
import { resolveLaunchSectionId } from './navigationPolicy';
import type {
  GeneratedSection,
  SectionBakedFloorLayer,
  SectionBakedFloorTileSprite,
  SectionBakedFloorTransitionOverlay,
  SectionRenderPayload,
} from '../types';
import { buildSectionRenderPayload } from '../map/buildSectionRenderPayload';

interface CreateGeneratedMapInput {
  mapId: string;
  sessionId: string;
  section: GeneratedSection;
  tileSizePx?: number;
  name?: string;
  renderPayloadCache?: Record<string, unknown> | null;
}

type PartialSectionRenderPayload =
  Pick<
    SectionRenderPayload,
    'width' | 'height' | 'tileSizePx' | 'backgroundColor' | 'floors' | 'walls' | 'markers'
  > &
  Partial<SectionRenderPayload>;

const normalizeBakedFloorLayer = (value: unknown): SectionBakedFloorLayer | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const layer = value as Record<string, unknown>;
  const status = layer.status;
  const chunkSizePx = layer.chunkSizePx;
  const tileResolutionPx = layer.tileResolutionPx;
  const floorCellsPerChunk = layer.floorCellsPerChunk;
  const chunks = layer.chunks;

  if (
    (status !== 'pending' &&
      status !== 'running' &&
      status !== 'complete' &&
      status !== 'failed') ||
    typeof chunkSizePx !== 'number' ||
    typeof tileResolutionPx !== 'number' ||
    typeof floorCellsPerChunk !== 'number' ||
    !Array.isArray(chunks)
  ) {
    return undefined;
  }

  const normalizedChunks = chunks
    .filter((chunk): chunk is Record<string, unknown> => Boolean(chunk) && typeof chunk === 'object')
    .map((chunk) => {
      const normalizedChunk = {
        chunkX: typeof chunk.chunkX === 'number' ? chunk.chunkX : 0,
        chunkY: typeof chunk.chunkY === 'number' ? chunk.chunkY : 0,
        x: typeof chunk.x === 'number' ? chunk.x : 0,
        y: typeof chunk.y === 'number' ? chunk.y : 0,
        widthPx: typeof chunk.widthPx === 'number' ? chunk.widthPx : 0,
        heightPx: typeof chunk.heightPx === 'number' ? chunk.heightPx : 0,
        imagePath: typeof chunk.imagePath === 'string' ? chunk.imagePath : '',
        imageUrl: typeof chunk.imageUrl === 'string' ? chunk.imageUrl : '',
      } as SectionBakedFloorLayer['chunks'][number];

      if (Array.isArray(chunk.tileSprites)) {
        normalizedChunk.tileSprites = chunk.tileSprites
          .filter((sprite): sprite is Record<string, unknown> => Boolean(sprite) && typeof sprite === 'object')
          .map((sprite): SectionBakedFloorTileSprite => normalizeBakedSprite(sprite));
      }

      if (Array.isArray(chunk.transitionOverlays)) {
        normalizedChunk.transitionOverlays = chunk.transitionOverlays
          .filter(
            (overlay): overlay is Record<string, unknown> => Boolean(overlay) && typeof overlay === 'object'
          )
          .map(
            (overlay): SectionBakedFloorTransitionOverlay => ({
              id: typeof overlay.id === 'string' ? overlay.id : '',
              x: typeof overlay.x === 'number' ? overlay.x : 0,
              y: typeof overlay.y === 'number' ? overlay.y : 0,
              widthPx: typeof overlay.widthPx === 'number' ? overlay.widthPx : 0,
              heightPx: typeof overlay.heightPx === 'number' ? overlay.heightPx : 0,
              fill: typeof overlay.fill === 'string' ? overlay.fill : 'transparent',
            })
          );
      }

      return normalizedChunk;
    });

  return {
    status,
    chunkSizePx,
    tileResolutionPx,
    floorCellsPerChunk,
    chunks: normalizedChunks,
  };
};

const normalizeBakedSprite = (
  sprite: Record<string, unknown>
): SectionBakedFloorTileSprite => ({
  assetId: typeof sprite.assetId === 'string' ? sprite.assetId : '',
  assetUrl: typeof sprite.assetUrl === 'string' ? sprite.assetUrl : '',
  fallbackAssetUrls: Array.isArray(sprite.fallbackAssetUrls)
    ? sprite.fallbackAssetUrls.filter((url): url is string => typeof url === 'string' && url.length > 0)
    : undefined,
  x: typeof sprite.x === 'number' ? sprite.x : 0,
  y: typeof sprite.y === 'number' ? sprite.y : 0,
  widthPx: typeof sprite.widthPx === 'number' ? sprite.widthPx : 0,
  heightPx: typeof sprite.heightPx === 'number' ? sprite.heightPx : 0,
  rotationDegrees: typeof sprite.rotationDegrees === 'number' ? sprite.rotationDegrees : 0,
  flipHorizontal: Boolean(sprite.flipHorizontal),
  flipVertical: Boolean(sprite.flipVertical),
});

export const normalizeSectionRenderPayload = (
  payload: PartialSectionRenderPayload
): SectionRenderPayload => ({
  ...payload,
  doors: payload.doors ?? [],
  hazards: payload.hazards ?? [],
  objects: payload.objects ?? [],
  atmosphere: payload.atmosphere ?? null,
  bakedFloor: normalizeBakedFloorLayer(payload.bakedFloor),
});

export const createGeneratedMapFromSection = ({
  mapId,
  sessionId,
  section,
  tileSizePx,
  name,
  renderPayloadCache,
}: CreateGeneratedMapInput): Map => {
  const renderPayload = normalizeSectionRenderPayload(
    {
      ...buildSectionRenderPayload(section, tileSizePx),
      bakedFloor: normalizeBakedFloorLayer(renderPayloadCache?.bakedFloor),
    }
  );

  return {
    id: mapId,
    sessionId,
    sourceType: 'generated',
    generatedSectionId: section.sectionId,
    generatedRenderPayload: renderPayload,
    name: name ?? section.sectionId,
    imageUrl: '',
    width: renderPayload.width,
    height: renderPayload.height,
    sortOrder: 0,
    createdAt: new Date(0).toISOString(),
    gridEnabled: true,
    gridOffsetX: 0,
    gridOffsetY: 0,
    gridCellSize: renderPayload.tileSizePx,
    gridColor: 'rgba(255,255,255,0.14)',
    fogEnabled: true,
    fogDefaultState: 'fogged',
    fogData: [],
    drawingData: [],
    effectsEnabled: false,
    effectData: [],
    showPlayerTokens: true,
  };
};

export const createGeneratedMapsFromSnapshot = ({
  sessionId,
  snapshot,
}: {
  sessionId: string;
  snapshot: CampaignSnapshot;
}) => {
  const visitedSections = getOrderedVisitedSections(snapshot);
  const maps = visitedSections.map((section) => {
    const generatedSection = section.generationState.generatedSection as GeneratedSection | undefined;

    return createGeneratedMapFromSection({
      mapId: `generated:${section.sectionId}`,
      sessionId,
      section: generatedSection ?? {
        ...(section.generationState.generatedSection as GeneratedSection),
      },
      name: section.name,
      renderPayloadCache: section.renderPayloadCache,
    });
  }).map((map, index) => ({ ...map, sortOrder: index }));

  const activeSectionId = resolveLaunchSectionId({
    activeSectionId: snapshot.campaign.activeSectionId,
  });
  const activeMap =
    maps.find((map) => map.generatedSectionId === activeSectionId) ?? maps[0] ?? null;

  return {
    maps,
    activeMap,
  };
};
