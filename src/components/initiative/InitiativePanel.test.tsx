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
      enableInitiativePhase: true,
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
    groupedEntries: {
      fastPcs: [
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
      fastNpcs: [],
      slowPcs: [],
      slowNpcs: [],
    },
    rollLogs: [],
    currentMapNpcs: [],
    hasCurrentPlayerEntry: true,
    setMyModifier: vi.fn(),
    addPlayerInitiative: vi.fn(),
    addNpcInitiative: vi.fn(),
    setPhaseForParticipant: vi.fn().mockResolvedValue({ success: true }),
    updateEntry: vi.fn().mockResolvedValue({ success: true }),
    deleteEntry: vi.fn().mockResolvedValue({ success: true }),
    clearTracker: vi.fn().mockResolvedValue({ success: true }),
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

describe('InitiativePanel Cosmere 4-Phase System', () => {
  beforeEach(() => {
    updateCharacterDetailsMock.mockClear();
    mockSessionState.currentUser.isGm = false;
    mockSessionState.session.enableInitiativePhase = true;
  });

  it('renders the 4-phase Cosmere turn order structure and allows switching phase', () => {
    render(<InitiativePanel />);

    expect(screen.getByText(/1. Fast Player Characters/i)).not.toBeNull();
    expect(screen.getByText(/2. Fast Enemies/i)).not.toBeNull();
    expect(screen.getByText(/3. Slow Player Characters/i)).not.toBeNull();
    expect(screen.getByText(/4. Slow Enemies/i)).not.toBeNull();

    // Player toggling to Slow turn
    const slowButton = screen.getByRole('button', { name: /slow turn/i });
    fireEvent.click(slowButton);

    expect(mockInitiative.setPhaseForParticipant).toHaveBeenCalledWith(
      {
        sourceType: 'player',
        sourceId: 'char_1',
        sourceName: 'Sir Henry',
      },
      'slow',
      'public'
    );
  });
});
