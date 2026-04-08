/* @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MapManager } from './MapManager';

const { updateMapSettingsMock } = vi.hoisted(() => ({
  updateMapSettingsMock: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../../hooks/useMap', () => ({
  useMap: () => ({
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
        tokenSizeOverrideEnabled: false,
        mediumTokenSizePx: null,
        fogEnabled: false,
        fogDefaultState: 'revealed',
        fogData: [],
        drawingData: [],
        effectsEnabled: false,
        effectData: [],
        showPlayerTokens: true,
      },
    ],
    activeMap: null,
    uploadMap: vi.fn(),
    addMapFromGlobalAsset: vi.fn(),
    setMapActive: vi.fn(),
    updateMapSettings: updateMapSettingsMock,
    deleteMap: vi.fn(),
  }),
}));

vi.mock('../shared/Toast', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

vi.mock('./GlobalAssetBrowser', () => ({
  GlobalAssetBrowser: () => <div>Global Asset Browser</div>,
}));

describe('MapManager medium token scale', () => {
  beforeEach(() => {
    updateMapSettingsMock.mockClear();
  });

  it('saves the token size override and medium token pixel size with readable preview labels', async () => {
    const user = userEvent.setup();

    render(<MapManager />);

    await user.click(screen.getByRole('button', { name: /map settings for room one/i }));

    const overrideCheckbox = screen.getByRole('checkbox', { name: /override token size/i }) as HTMLInputElement;
    expect(overrideCheckbox.checked).toBe(false);
    expect(screen.queryByRole('spinbutton', { name: /medium token size \(px\)/i })).toBeNull();
    expect(screen.queryByText(/token size preview/i)).toBeNull();
    expect(screen.getByText(/customize/i)).not.toBeNull();

    await user.click(overrideCheckbox);
    expect(overrideCheckbox.checked).toBe(true);
    expect(
      (screen.getByRole('spinbutton', { name: /medium token size \(px\)/i }) as HTMLInputElement).value
    ).toBe('50');
    expect(screen.getByText(/tiny/i)).not.toBeNull();
    expect(screen.getByText(/gargantuan/i)).not.toBeNull();

    const previewHeading = screen.getByText(/token size preview/i);
    const previewGrid = previewHeading.nextElementSibling as HTMLDivElement | null;
    const mediumPreviewLabel = screen.getByText(/^medium$/i);
    const mediumPreviewMeta = mediumPreviewLabel.parentElement as HTMLDivElement | null;

    expect(previewGrid?.className).toContain('grid-cols-2');
    expect(previewGrid?.className).not.toContain('sm:grid-cols-3');
    expect(mediumPreviewMeta?.className).toContain('text-center');
    expect(mediumPreviewMeta?.className).not.toContain('flex');

    fireEvent.change(screen.getByRole('spinbutton', { name: /medium token size \(px\)/i }), {
      target: { value: '72' },
    });
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(updateMapSettingsMock).toHaveBeenCalledWith(
      'map_001',
      expect.objectContaining({ tokenSizeOverrideEnabled: true, mediumTokenSizePx: 72 })
    );
  });
});
