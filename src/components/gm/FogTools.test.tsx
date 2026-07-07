/* @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FogTools } from './FogTools';

const { activeMapState, updateFogDataMock } = vi.hoisted(() => ({
  activeMapState: {
    id: 'map_001',
    fogEnabled: true,
    fogDefaultState: 'fogged',
    fogData: [],
    width: 1200,
    height: 800,
  },
  updateFogDataMock: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../../stores/mapStore', () => ({
  getFogBrushPixelSize: (size: 'small' | 'medium' | 'large') =>
    size === 'small' ? 30 : size === 'medium' ? 60 : 120,
  useMapStore: (selector: (state: unknown) => unknown) =>
    selector({
      activeMap: activeMapState,
      fogToolMode: null,
      fogBrushSize: 'medium',
      fogToolShape: 'brush',
      setFogToolMode: vi.fn(),
      setFogBrushSize: vi.fn(),
      setFogToolShape: vi.fn(),
    }),
}));

vi.mock('../../hooks/useMap', () => ({
  useMap: () => ({
    updateFogData: updateFogDataMock,
  }),
}));

vi.mock('../shared/Toast', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

describe('FogTools', () => {
  beforeEach(() => {
    updateFogDataMock.mockClear();
    activeMapState.fogDefaultState = 'fogged';
    activeMapState.fogData = [];
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('reveals the full map when clearing fog on a default-fogged map', async () => {
    render(<FogTools />);

    fireEvent.click(screen.getByRole('button', { name: /reveal all/i }));

    await waitFor(() => {
      expect(updateFogDataMock).toHaveBeenCalledWith('map_001', [
        {
          type: 'reveal',
          points: [
            { x: 0, y: 0 },
            { x: 1200, y: 0 },
            { x: 1200, y: 800 },
            { x: 0, y: 800 },
            { x: 0, y: 0 },
          ],
          brushSize: 1,
        },
      ]);
    });
  });
});
