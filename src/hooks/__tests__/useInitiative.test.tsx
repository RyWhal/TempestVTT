/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useInitiative } from '../useInitiative';

const {
  fromMock,
  mockSessionState,
  mockMapState,
  mockInitiativeState,
  existingEntryLookup,
  updateEntryById,
  insertRollLog,
} = vi.hoisted(() => ({
  fromMock: vi.fn(),
  mockSessionState: {
    session: {
      id: 'session_001',
      code: 'ABCD12',
      name: 'Shared Table',
      enableInitiativePhase: false,
    },
    currentUser: {
      username: 'Kaladin',
      characterId: 'char_1',
      isGm: false,
    },
    players: [
      {
        id: 'player_1',
        username: 'Kaladin',
        initiativeModifier: 3,
      },
    ],
  },
  mockMapState: {
    characters: [
      {
        id: 'char_1',
        name: 'Kaladin',
        claimedByUsername: 'Kaladin',
      },
    ],
    activeMap: {
      id: 'map_1',
    },
    npcInstances: [],
  },
  mockInitiativeState: {
    entries: [],
    rollLogs: [],
    setEntries: vi.fn(),
  },
  existingEntryLookup: vi.fn(),
  updateEntryById: vi.fn(),
  insertRollLog: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: fromMock,
  },
}));

vi.mock('../../stores/sessionStore', () => ({
  useSessionStore: (selector: (state: typeof mockSessionState) => unknown) =>
    selector(mockSessionState),
}));

vi.mock('../../stores/mapStore', () => ({
  useMapStore: (selector: (state: typeof mockMapState) => unknown) => selector(mockMapState),
}));

vi.mock('../../stores/initiativeStore', () => ({
  useInitiativeStore: (selector: (state: typeof mockInitiativeState) => unknown) =>
    selector(mockInitiativeState),
}));

describe('useInitiative', () => {
  beforeEach(() => {
    fromMock.mockReset();
    existingEntryLookup.mockReset();
    updateEntryById.mockReset();
    insertRollLog.mockReset();

    existingEntryLookup.mockResolvedValue({
      data: { id: 'entry_1' },
      error: null,
    });
    updateEntryById.mockResolvedValue({ error: null });
    insertRollLog.mockResolvedValue({ error: null });

    fromMock.mockImplementation((table: string) => {
      if (table === 'initiative_entries') {
        return {
          select: () => {
            const thirdEqResult = { maybeSingle: existingEntryLookup };
            const secondEqResult = {
              eq: vi.fn().mockReturnValue(thirdEqResult),
              is: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({ maybeSingle: existingEntryLookup }),
              }),
            };

            return {
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue(secondEqResult),
              }),
            };
          },
          update: vi.fn().mockReturnValue({
            eq: updateEntryById,
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn(),
            }),
          }),
        };
      }

      if (table === 'initiative_roll_logs') {
        return {
          insert: insertRollLog,
        };
      }

      return {};
    });
  });

  it('blocks player re-rolls while they already have an initiative entry', async () => {
    const { result } = renderHook(() => useInitiative());

    const response = await result.current.addPlayerInitiative('fast', 'public');

    expect(response).toEqual({
      success: false,
      error: 'You are already in the initiative order. Ask the GM to remove you before rolling again.',
    });
    expect(updateEntryById).not.toHaveBeenCalled();
    expect(insertRollLog).not.toHaveBeenCalled();
  });
});
