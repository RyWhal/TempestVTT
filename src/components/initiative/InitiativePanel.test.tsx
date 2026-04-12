/* @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InitiativePanel } from './InitiativePanel';

const {
  updateCharacterDetailsMock,
  mockSessionState,
  mockInitiative,
} = vi.hoisted(() => ({
  updateCharacterDetailsMock: vi.fn().mockResolvedValue({ success: true }),
  mockSessionState: {
    players: [
      {
        id: 'player_1',
        username: 'Kaladin',
        initiativeModifier: 3,
      },
    ],
    currentUser: {
      username: 'Kaladin',
      characterId: 'char_1',
      isGm: false,
    },
    session: {
      allowPlayersRenamePcs: true,
      enableInitiativePhase: false,
    },
  },
  mockInitiative: {
    entries: [
      {
        id: 'entry_1',
        sourceType: 'player',
        sourceId: 'char_1',
        sourceName: 'Sir Henry',
        modifier: 3,
        rollValue: 15,
        total: 18,
        phase: 'fast',
        visibility: 'public',
      },
      {
        id: 'entry_2',
        sourceType: 'player',
        sourceId: 'char_2',
        sourceName: 'Adolin',
        modifier: 2,
        rollValue: 12,
        total: 14,
        phase: 'fast',
        visibility: 'public',
      },
    ],
    rollLogs: [],
    currentMapNpcs: [],
    hasCurrentPlayerEntry: true,
    setMyModifier: vi.fn(),
    addPlayerInitiative: vi.fn(),
    addNpcInitiative: vi.fn(),
    updateEntry: vi.fn(),
    deleteEntry: vi.fn(),
    clearTracker: vi.fn(),
  },
}));

vi.mock('../../hooks/useInitiative', () => ({
  useInitiative: () => mockInitiative,
}));

vi.mock('../../hooks/useNPCs', () => ({
  useNPCs: () => ({
    updateNPCInstanceDetails: vi.fn(),
  }),
}));

vi.mock('../../hooks/useCharacters', () => ({
  useCharacters: () => ({
    myCharacter: {
      id: 'char_1',
      name: 'Sir Henry',
    },
    updateCharacterDetails: updateCharacterDetailsMock,
  }),
}));

vi.mock('../../stores/sessionStore', () => ({
  useSessionStore: (selector: (state: typeof mockSessionState) => unknown) =>
    selector(mockSessionState),
}));

vi.mock('../shared/Toast', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

describe('InitiativePanel PC renaming', () => {
  beforeEach(() => {
    updateCharacterDetailsMock.mockClear();
    mockSessionState.currentUser.isGm = false;
    mockSessionState.session.allowPlayersRenamePcs = true;
  });

  it('lets a player rename only the PC they currently control when enabled', () => {
    render(<InitiativePanel />);

    const renameInput = screen.getByRole('textbox', { name: /rename sir henry/i });
    fireEvent.change(renameInput, { target: { value: 'Stormblessed' } });
    fireEvent.blur(renameInput);

    expect(updateCharacterDetailsMock).toHaveBeenCalledWith('char_1', {
      name: 'Stormblessed',
    });
    expect(screen.queryByRole('textbox', { name: /rename adolin/i })).toBeNull();
  });

  it('hides player rename controls when the session setting is disabled', () => {
    mockSessionState.session.allowPlayersRenamePcs = false;

    render(<InitiativePanel />);

    expect(screen.queryByRole('textbox', { name: /rename sir henry/i })).toBeNull();
  });
});
