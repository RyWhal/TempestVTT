import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMap } from '../useMap';

const { fromMock, updateMock, eqMock, updateMapStoreMock } = vi.hoisted(() => {
  const eqMock = vi.fn().mockResolvedValue({ error: null });
  const updateMock = vi.fn().mockReturnValue({ eq: eqMock });

  return {
    fromMock: vi.fn(() => ({ update: updateMock })),
    updateMock,
    eqMock,
    updateMapStoreMock: vi.fn(),
  };
});

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: fromMock,
  },
  uploadFile: vi.fn(),
  deleteFile: vi.fn(),
  STORAGE_BUCKETS: {},
}));

vi.mock('../../stores/sessionStore', () => ({
  useSessionStore: (selector: (state: { session: null }) => unknown) =>
    selector({ session: null }),
}));

vi.mock('../../stores/mapStore', () => ({
  useMapStore: () => ({
    maps: [],
    activeMap: null,
    setActiveMap: vi.fn(),
    addMap: vi.fn(),
    updateMap: updateMapStoreMock,
    removeMap: vi.fn(),
  }),
}));

describe('useMap.updateMapSettings', () => {
  beforeEach(() => {
    fromMock.mockClear();
    updateMock.mockClear();
    eqMock.mockClear();
    updateMapStoreMock.mockClear();
  });

  it('persists token size override settings to the maps table', async () => {
    let updateMapSettings:
      | ((mapId: string, settings: { tokenSizeOverrideEnabled: boolean; mediumTokenSizePx: number }) => Promise<{ success: boolean; error?: string }>)
      | null = null;

    const Harness = () => {
      updateMapSettings = useMap().updateMapSettings;
      return null;
    };

    renderToString(<Harness />);

    if (!updateMapSettings) {
      throw new Error('Harness did not initialize useMap');
    }

    const updateMapSettingsFn = updateMapSettings as (
      mapId: string,
      settings: { tokenSizeOverrideEnabled: boolean; mediumTokenSizePx: number }
    ) => Promise<{ success: boolean; error?: string }>;
    const result = await updateMapSettingsFn('map_001', {
      tokenSizeOverrideEnabled: true,
      mediumTokenSizePx: 72,
    });

    expect(result).toEqual({ success: true });
    expect(fromMock).toHaveBeenCalledWith('maps');
    expect(updateMock).toHaveBeenCalledWith({
      token_size_override_enabled: true,
      medium_token_size_px: 72,
    });
    expect(eqMock).toHaveBeenCalledWith('id', 'map_001');
    expect(updateMapStoreMock).toHaveBeenCalledWith('map_001', {
      tokenSizeOverrideEnabled: true,
      mediumTokenSizePx: 72,
    });
  });

  it('returns a migration hint when token size override columns are missing from the schema', async () => {
    eqMock.mockResolvedValueOnce({
      error: {
        code: 'PGRST204',
        message: "Could not find the 'token_size_override_enabled' column of 'maps' in the schema cache",
      },
    });

    let updateMapSettings:
      | ((mapId: string, settings: { tokenSizeOverrideEnabled: boolean; mediumTokenSizePx: number }) => Promise<{ success: boolean; error?: string }>)
      | null = null;

    const Harness = () => {
      updateMapSettings = useMap().updateMapSettings;
      return null;
    };

    renderToString(<Harness />);

    if (!updateMapSettings) {
      throw new Error('Harness did not initialize useMap');
    }

    const updateMapSettingsFn = updateMapSettings as (
      mapId: string,
      settings: { tokenSizeOverrideEnabled: boolean; mediumTokenSizePx: number }
    ) => Promise<{ success: boolean; error?: string }>;
    const result = await updateMapSettingsFn('map_001', {
      tokenSizeOverrideEnabled: true,
      mediumTokenSizePx: 72,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('014_map_medium_token_scale.sql');
    expect(updateMapStoreMock).not.toHaveBeenCalled();
  });
});
