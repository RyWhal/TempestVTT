import { TOKEN_SIZE_MULTIPLIERS, type TokenSize } from '../types';

export const DEFAULT_MEDIUM_TOKEN_SIZE_PX = 50;
export const MIN_MEDIUM_TOKEN_SIZE_PX = 16;
export const MAX_MEDIUM_TOKEN_SIZE_PX = 300;

export const clampMediumTokenSizePx = (value: number) => {
  if (!Number.isFinite(value)) {
    return DEFAULT_MEDIUM_TOKEN_SIZE_PX;
  }

  return Math.min(MAX_MEDIUM_TOKEN_SIZE_PX, Math.max(MIN_MEDIUM_TOKEN_SIZE_PX, value));
};

export const getBaseMediumTokenSizePx = ({
  gridCellSize,
  tokenSizeOverrideEnabled,
  mediumTokenSizePx,
}: {
  gridCellSize: number;
  tokenSizeOverrideEnabled: boolean;
  mediumTokenSizePx: number | null;
}) => {
  const safeGridCellSize =
    Number.isFinite(gridCellSize) && gridCellSize > 0
      ? gridCellSize
      : DEFAULT_MEDIUM_TOKEN_SIZE_PX;

  if (!tokenSizeOverrideEnabled) {
    return safeGridCellSize;
  }

  return clampMediumTokenSizePx(mediumTokenSizePx ?? safeGridCellSize);
};

export const getTokenPixelSize = ({
  gridCellSize,
  tokenSizeOverrideEnabled,
  mediumTokenSizePx,
  size,
}: {
  gridCellSize: number;
  tokenSizeOverrideEnabled: boolean;
  mediumTokenSizePx: number | null;
  size: TokenSize;
}) =>
  getBaseMediumTokenSizePx({
    gridCellSize,
    tokenSizeOverrideEnabled,
    mediumTokenSizePx,
  }) * TOKEN_SIZE_MULTIPLIERS[size];
