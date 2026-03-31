import { describe, expect, it } from 'vitest';
import {
  buildGeneratedImageCandidateUrls,
  buildGeneratedGritClipRects,
  buildGeneratedGritOverlayUrl,
  shouldRenderGeneratedChunkTransitionOverlays,
  shouldRenderGeneratedGritOverlay,
  shouldRenderGeneratedLiveWallStamps,
  shouldPreferGeneratedFloorTileSprites,
} from './generatedFloorRender';

describe('generatedFloorRender', () => {
  it('builds stable unique candidate urls for image loading', () => {
    expect(
      buildGeneratedImageCandidateUrls('blob:chunk-image', [
        'blob:chunk-image',
        'data:image/svg+xml;base64,abc',
        'data:image/svg+xml;base64,abc',
        '',
      ])
    ).toEqual(['blob:chunk-image', 'data:image/svg+xml;base64,abc']);
  });

  it('does not prefer per-tile sprites on localhost when the chunk image has not failed', () => {
    expect(
      shouldPreferGeneratedFloorTileSprites({
        isLocalBrowserRuntime: true,
        chunkImageFailed: false,
        hasTileSprites: true,
      })
    ).toBe(false);
  });

  it('falls back to per-tile sprites only when the chunk image failed and sprites exist', () => {
    expect(
      shouldPreferGeneratedFloorTileSprites({
        isLocalBrowserRuntime: true,
        chunkImageFailed: true,
        hasTileSprites: true,
      })
    ).toBe(true);
  });

  it('picks a deterministic grit overlay variant per generated map', () => {
    expect(buildGeneratedGritOverlayUrl('generated_map_alpha')).toMatch(
      /^\/assets\/DarkGrit-[abcd]\.png$/
    );
    expect(buildGeneratedGritOverlayUrl('generated_map_alpha')).toBe(
      buildGeneratedGritOverlayUrl('generated_map_alpha')
    );
  });

  it('builds clip rects from generated floor spans so grit stays off the void', () => {
    expect(
      buildGeneratedGritClipRects([
        { x: 10, y: 20, width: 30, height: 40 },
        { x: 50, y: 60, width: 70, height: 80 },
      ])
    ).toEqual([
      { x: 10, y: 20, width: 30, height: 40 },
      { x: 50, y: 60, width: 70, height: 80 },
    ]);
  });

  it('keeps grit disabled by default even when floors exist', () => {
    expect(
      shouldRenderGeneratedGritOverlay({
        gritEnabled: false,
        floorCount: 3,
      })
    ).toBe(false);
  });

  it('does not render live wall stamps when baked floor chunks are available', () => {
    expect(
      shouldRenderGeneratedLiveWallStamps({
        hasBakedFloorLayer: true,
      })
    ).toBe(false);
  });

  it('does not render live transition overlays when baked floor chunks are available', () => {
    expect(
      shouldRenderGeneratedChunkTransitionOverlays({
        hasBakedFloorLayer: true,
      })
    ).toBe(false);
  });
});
