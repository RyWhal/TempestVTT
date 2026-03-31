export const buildGeneratedImageCandidateUrls = (
  assetUrl: string | null,
  fallbackUrls: string[]
): string[] =>
  [assetUrl, ...fallbackUrls].filter(
    (value, index, items): value is string => Boolean(value) && items.indexOf(value) === index
  );

export const shouldPreferGeneratedFloorTileSprites = ({
  isLocalBrowserRuntime,
  chunkImageFailed,
  hasTileSprites,
}: {
  isLocalBrowserRuntime: boolean;
  chunkImageFailed: boolean;
  hasTileSprites: boolean;
}) => isLocalBrowserRuntime && chunkImageFailed && hasTileSprites;

export const shouldRenderGeneratedGritOverlay = ({
  gritEnabled,
  floorCount,
}: {
  gritEnabled: boolean;
  floorCount: number;
}) => gritEnabled && floorCount > 0;

export const shouldRenderGeneratedLiveWallStamps = ({
  hasBakedFloorLayer,
}: {
  hasBakedFloorLayer: boolean;
}) => !hasBakedFloorLayer;

export const shouldRenderGeneratedChunkTransitionOverlays = ({
  hasBakedFloorLayer,
}: {
  hasBakedFloorLayer: boolean;
}) => !hasBakedFloorLayer;

const stableHash = (value: string) => {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

export const buildGeneratedGritOverlayUrl = (mapId: string) => {
  const variants = ['a', 'b', 'c', 'd'] as const;
  const index = stableHash(mapId) % variants.length;
  return `/assets/DarkGrit-${variants[index]}.png`;
};

export const buildGeneratedGritClipRects = <
  T extends { x: number; y: number; width: number; height: number }
>(
  floors: T[]
) =>
  floors.map((floor) => ({
    x: floor.x,
    y: floor.y,
    width: floor.width,
    height: floor.height,
  }));
