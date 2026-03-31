import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStarterCampaignSnapshot } from '../engine/campaignFlow';
import {
  getLocalCampaignStorageKey,
  loadLocalCampaignSnapshot,
  saveLocalCampaignSnapshot,
} from '../integration/localCampaignPersistence';

describe('localCampaignPersistence', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('stores a compact campaign snapshot without heavyweight render payload caches', () => {
    const starter = createStarterCampaignSnapshot({
      sessionId: 'session_001',
      campaignName: 'The Bloom Beneath',
      worldSeed: 'world_ironbell_042',
    });
    const setItem = vi.fn();

    starter.sections[0] = {
      ...starter.sections[0],
      renderPayloadCache: {
        bakedFloor: {
          status: 'complete',
          chunkSizePx: 1024,
          tileResolutionPx: 256,
          floorCellsPerChunk: 16,
          chunks: [
            {
              chunkX: 0,
              chunkY: 0,
              x: 0,
              y: 0,
              widthPx: 1024,
              heightPx: 1024,
              imagePath: 'generated-floor/run/chunk_0_0.svg',
              imageUrl: 'https://example.com/generated-floor/run/chunk_0_0.svg',
              tileSprites: [
                {
                  assetId: 'sprite_001',
                  assetUrl: 'data:image/svg+xml;base64,Zm9v',
                  x: 0,
                  y: 0,
                  widthPx: 256,
                  heightPx: 256,
                  rotationDegrees: 0,
                  flipHorizontal: false,
                  flipVertical: false,
                },
              ],
            },
          ],
        },
      },
    };

    vi.stubGlobal('window', {
      localStorage: {
        getItem: vi.fn(),
        setItem,
        removeItem: vi.fn(),
        clear: vi.fn(),
        key: vi.fn(),
        length: 0,
      },
    });

    const saved = saveLocalCampaignSnapshot({
      sessionId: 'session_001',
      snapshot: starter,
    });

    expect(saved).toBe(true);
    expect(setItem).toHaveBeenCalledWith(
      getLocalCampaignStorageKey('session_001'),
      expect.any(String)
    );
    const payload = JSON.parse(setItem.mock.calls[0][1]);
    expect(payload.snapshot.sections[0].renderPayloadCache).toBeNull();
  });

  it('loads a compact snapshot back into campaign state', () => {
    const starter = createStarterCampaignSnapshot({
      sessionId: 'session_001',
      campaignName: 'The Bloom Beneath',
      worldSeed: 'world_ironbell_042',
    });

    vi.stubGlobal('window', {
      localStorage: {
        getItem: vi.fn().mockReturnValue(
          JSON.stringify({
            version: 1,
            snapshot: {
              ...starter,
              sections: starter.sections.map((section) => ({
                ...section,
                renderPayloadCache: null,
              })),
            },
          })
        ),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        key: vi.fn(),
        length: 0,
      },
    });

    const loaded = loadLocalCampaignSnapshot('session_001');

    expect(loaded?.campaign.name).toBe('The Bloom Beneath');
    expect(loaded?.sections[0]?.renderPayloadCache).toBeNull();
  });
});
