import { describe, expect, it, vi } from 'vitest';
import { buildSessionExport } from './sessionExport';

describe('buildSessionExport', () => {
  it('includes tokenSettings separately from grid settings', async () => {
    const exportData = await buildSessionExport({
      session: {
        name: 'Shared Table',
        notepadContent: '',
      },
      maps: [
        {
          id: 'map_001',
          sessionId: 'session_001',
          name: 'Room One',
          imageUrl: 'https://example.com/map.png',
          width: 1000,
          height: 1000,
          sortOrder: 0,
          createdAt: '2026-04-06T00:00:00.000Z',
          gridEnabled: true,
          gridOffsetX: 0,
          gridOffsetY: 0,
          gridCellSize: 50,
          gridColor: '#000000',
          tokenSizeOverrideEnabled: true,
          mediumTokenSizePx: 72,
          fogEnabled: false,
          fogDefaultState: 'revealed',
          fogData: [],
          drawingData: [],
          effectsEnabled: false,
          effectData: [],
          showPlayerTokens: true,
        },
      ],
      characters: [],
      npcTemplates: [],
      npcInstances: [],
      fetchAsBase64: vi.fn().mockResolvedValue('data:image/png;base64,AAA'),
    });

    expect(exportData.maps[0].gridSettings.cellSize).toBe(50);
    expect(exportData.maps[0].tokenSettings.overrideEnabled).toBe(true);
    expect(exportData.maps[0].tokenSettings.mediumSizePx).toBe(72);
  });
});
