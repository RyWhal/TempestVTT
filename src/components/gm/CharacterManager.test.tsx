/* @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CharacterManager } from './CharacterManager';

const { updateCharacterTokenMock, updateCharacterDetailsMock } = vi.hoisted(() => ({
  updateCharacterTokenMock: vi.fn().mockResolvedValue({ success: true }),
  updateCharacterDetailsMock: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../../hooks/useCharacters', () => ({
  useCharacters: () => ({
    characters: [
      {
        id: 'char_001',
        name: 'Kaladin',
        tokenUrl: 'https://example.com/kaladin.png',
        size: 'medium',
        statusRingColor: null,
        positionX: 0,
        positionY: 0,
        isClaimed: true,
        claimedByUsername: 'jhang',
        inventory: [],
        notes: '',
        createdAt: '2026-04-01T00:00:00.000Z',
      },
    ],
    createCharacter: vi.fn(),
    updateCharacterToken: updateCharacterTokenMock,
    updateCharacterDetails: updateCharacterDetailsMock,
    deleteCharacter: vi.fn(),
    releaseCharacter: vi.fn(),
  }),
}));

vi.mock('../../stores/mapStore', () => ({
  useMapStore: (selector: (state: any) => unknown) =>
    selector({
      activeMap: {
        id: 'map_001',
      },
      viewportScale: 1,
      stageWidth: 800,
      stageHeight: 600,
      selectToken: vi.fn(),
      setViewportPosition: vi.fn(),
    }),
}));

vi.mock('../shared/Toast', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

describe('CharacterManager', () => {
  beforeEach(() => {
    updateCharacterTokenMock.mockClear();
    updateCharacterDetailsMock.mockClear();
  });

  it('uses the token portrait hover upload instead of a separate change token button', () => {
    render(<CharacterManager />);

    expect(screen.queryByRole('button', { name: /change token/i })).toBeNull();
    expect(screen.getByLabelText(/change token for kaladin/i)).not.toBeNull();
  });

  it('updates an existing character token from the explicit control', () => {
    render(<CharacterManager />);

    const input = screen.getByLabelText(/change token for kaladin/i);
    const file = new File(['token'], 'kaladin.webp', { type: 'image/webp' });

    fireEvent.change(input, { target: { files: [file] } });

    expect(updateCharacterTokenMock).toHaveBeenCalledWith('char_001', file);
  });

  it('uses a compact status swatch picker instead of a wide dropdown', () => {
    render(<CharacterManager />);

    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByRole('button', { name: /status ring color for kaladin/i })).not.toBeNull();
  });

  it('updates the status ring color from the compact swatch picker', () => {
    render(<CharacterManager />);

    fireEvent.click(screen.getByRole('button', { name: /status ring color for kaladin/i }));
    fireEvent.click(screen.getByRole('button', { name: /green status ring/i }));

    expect(updateCharacterDetailsMock).toHaveBeenCalledWith('char_001', {
      statusRingColor: '#22c55e',
    });
  });
});
