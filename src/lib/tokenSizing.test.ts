import { describe, expect, it } from 'vitest';
import { clampMediumTokenSizePx, getTokenPixelSize } from './tokenSizing';

describe('getTokenPixelSize', () => {
  it('uses the grid cell size when token size override is off', () => {
    expect(
      getTokenPixelSize({
        gridCellSize: 50,
        tokenSizeOverrideEnabled: false,
        mediumTokenSizePx: 72,
        size: 'large',
      })
    ).toBe(100);
  });

  it('uses the medium token pixel size override when it is enabled', () => {
    expect(
      getTokenPixelSize({
        gridCellSize: 50,
        tokenSizeOverrideEnabled: true,
        mediumTokenSizePx: 72,
        size: 'large',
      })
    ).toBe(144);
    expect(
      getTokenPixelSize({
        gridCellSize: 50,
        tokenSizeOverrideEnabled: true,
        mediumTokenSizePx: 72,
        size: 'tiny',
      })
    ).toBe(36);
  });
});

describe('clampMediumTokenSizePx', () => {
  it('keeps the pixel size within the supported range', () => {
    expect(clampMediumTokenSizePx(-10)).toBe(16);
    expect(clampMediumTokenSizePx(999)).toBe(300);
    expect(clampMediumTokenSizePx(Number.NaN)).toBe(50);
  });
});
