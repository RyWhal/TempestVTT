/* @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InitiativePanel } from './InitiativePanel';

const {
  updateCharacterDetailsMock,
  mockSessionState,
  mockInitiative,
  mockCharacter,
  showToastMock,
} = vi.hoisted(() => ({
  mockCharacter: { value: { id: 'char_1', name: 'Sir Henry' } as { id: string; name: string } | null },
  showToastMock: vi.fn(),
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
    currentMapNpcs: [] as { id: string; displayName: string }[],
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
    myCharacter: mockCharacter.value,
    updateCharacterDetails: updateCharacterDetailsMock,
  }),
}));

vi.mock('../../stores/sessionStore', () => ({
  useSessionStore: (selector: (state: typeof mockSessionState) => unknown) =>
    selector(mockSessionState),
}));

vi.mock('../shared/Toast', () => ({
  useToast: () => ({
    showToast: showToastMock,
  }),
}));

describe('InitiativePanel Cosmere 4-Phase System', () => {
  beforeEach(() => {
    updateCharacterDetailsMock.mockClear();
    mockSessionState.currentUser.isGm = false;
    mockSessionState.session.enableInitiativePhase = true;
    mockCharacter.value = { id: 'char_1', name: 'Sir Henry' };
    mockInitiative.currentMapNpcs = [];
    mockInitiative.setPhaseForParticipant.mockReset().mockResolvedValue({ success: true });
    showToastMock.mockClear();
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
      'slow'
    );
  });

  it('restores classic rolling, modifier and totals', async () => {
    mockSessionState.session.enableInitiativePhase = false;
    mockInitiative.hasCurrentPlayerEntry = false;
    mockInitiative.setMyModifier.mockResolvedValue({ success: true });
    mockInitiative.addPlayerInitiative.mockResolvedValue({ success: true });
    render(<InitiativePanel />);
    expect(screen.getByText('Total: 18')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Your initiative modifier'), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Roll Initiative (d20)' }));
    await waitFor(() => expect(mockInitiative.addPlayerInitiative).toHaveBeenCalledWith('fast', 'public', 7));
    expect(mockInitiative.setMyModifier).toHaveBeenCalledWith(7);
  });

  it('allows a player without a claimed character to choose a phase using their username', () => {
    mockCharacter.value = null;
    render(<InitiativePanel />);
    fireEvent.click(screen.getByRole('button', { name: /slow turn/i }));
    expect(mockInitiative.setPhaseForParticipant).toHaveBeenCalledWith({ sourceType: 'player', sourceId: null, sourceName: 'Kaladin' }, 'slow');
  });

  it('reports partial NPC failures and keeps only failed NPCs selected for retry', async () => {
    mockSessionState.currentUser.isGm = true;
    mockInitiative.currentMapNpcs = [{ id: 'npc_1', displayName: 'Guard' }, { id: 'npc_2', displayName: 'Scout' }];
    mockInitiative.setPhaseForParticipant.mockResolvedValueOnce({ success: true }).mockResolvedValueOnce({ success: false, error: 'Denied' });
    render(<InitiativePanel />);
    fireEvent.click(screen.getByLabelText('Guard'));
    fireEvent.click(screen.getByLabelText('Scout'));
    fireEvent.click(screen.getByRole('button', { name: /add selected to initiative/i }));
    await waitFor(() => expect(showToastMock).toHaveBeenCalledWith('Added 1 NPCs; 1 failed. Retry the selected NPCs.', 'error'));
    expect((screen.getByLabelText('Guard') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText('Scout') as HTMLInputElement).checked).toBe(true);
  });

  it('shows GM audit in the GM view for phase and classic modes', () => {
    mockSessionState.currentUser.isGm = true;
    const { rerender } = render(<InitiativePanel />);
    expect(screen.getByText('Initiative Roll Audit')).toBeTruthy();
    mockSessionState.session.enableInitiativePhase = false;
    rerender(<InitiativePanel gmView />);
    expect(screen.getByText('Initiative Roll Audit')).toBeTruthy();
    expect(screen.getByLabelText('Total for Sir Henry')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Roll and Add Selected NPCs' })).toBeTruthy();
  });
});
