/* @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionExport } from './SessionExport';

const { showToastMock } = vi.hoisted(() => ({
  showToastMock: vi.fn(),
}));

vi.mock('../../stores/sessionStore', () => ({
  useSessionStore: (selector: (state: { session: any }) => unknown) =>
    selector({
      session: {
        id: 'session_001',
        code: 'ABCD12',
        name: 'Shared Table',
        notepadContent: '',
      },
    }),
}));

vi.mock('../../stores/mapStore', () => ({
  useMapStore: (selector?: (state: any) => unknown) => {
    const state = {
      maps: [],
      characters: [],
      npcTemplates: [],
      npcInstances: [],
    };

    return selector ? selector(state) : state;
  },
}));

vi.mock('../shared/Toast', () => ({
  useToast: () => ({
    showToast: showToastMock,
  }),
}));

describe('SessionExport import preview', () => {
  beforeEach(() => {
    showToastMock.mockClear();
  });

  it('accepts exported map JSON that includes tokenSettings', async () => {
    render(<SessionExport />);

    const input = screen.getByLabelText(/import session file/i);
    const payload = JSON.stringify({
      version: '1.0',
      exportedAt: '2026-04-06T00:00:00.000Z',
      session: { name: 'Shared Table', notepadContent: '' },
      maps: [
        {
          name: 'Room One',
          imageBase64: '',
          width: 1000,
          height: 1000,
          gridSettings: {
            enabled: true,
            offsetX: 0,
            offsetY: 0,
            cellSize: 50,
            color: '#000000',
          },
          tokenSettings: {
            overrideEnabled: true,
            mediumSizePx: 72,
          },
          fogSettings: { enabled: false, defaultState: 'revealed', fogData: [] },
          showPlayerTokens: true,
          npcInstances: [],
        },
      ],
      characters: [],
      npcTemplates: [],
    });
    const file = new File(
      [payload],
      'session.json',
      { type: 'application/json' }
    );
    Object.defineProperty(file, 'text', {
      value: vi.fn().mockResolvedValue(payload),
    });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith(
        expect.stringMatching(/import preview/i),
        'info'
      );
    });
  });
});
