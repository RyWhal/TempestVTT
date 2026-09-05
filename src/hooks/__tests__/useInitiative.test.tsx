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
  updatePayload,
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
    npcInstances: [] as { id: string; displayName: string; mapId: string }[],
  },
  mockInitiativeState: {
    entries: [],
    rollLogs: [],
    setEntries: vi.fn(),
  },
  existingEntryLookup: vi.fn(),
  updateEntryById: vi.fn(),
  insertRollLog: vi.fn(),
  updatePayload: vi.fn(),
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
    updatePayload.mockReset();
    mockSessionState.currentUser.isGm = false;
    mockMapState.npcInstances = [];

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
          update: updatePayload.mockReturnValue({
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

  it('preserves GM-hidden visibility when a player changes phase even with explicit public visibility', async () => {
    const { result } = renderHook(() => useInitiative());
    await result.current.setPhaseForParticipant({ sourceType: 'player', sourceId: 'char_1', sourceName: 'Kaladin' }, 'slow', 'public');
    expect(updatePayload).toHaveBeenCalledWith({ phase: 'slow' });
  });

  it('counts saved NPCs with failed audit logs as added and excludes them from retry', async () => {
    mockSessionState.currentUser.isGm = true;
    mockMapState.npcInstances = [{ id: 'npc_1', displayName: 'Guard', mapId: 'map_1' }, { id: 'npc_2', displayName: 'Scout', mapId: 'map_1' }];
    insertRollLog.mockResolvedValueOnce({ error: { message: 'Audit unavailable' } });
    updateEntryById.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { message: 'Entry denied' } });
    const { result } = renderHook(() => useInitiative());
    const response = await result.current.addNpcInitiative(['npc_1', 'npc_2'], 'fast', 'public', 0);
    expect(response.success).toBe(false);
    expect(response.failedIds).toEqual(['npc_2']);
    expect(response.error).toContain('Added 1 NPCs; 1 failed to add; 1 audit logs failed');
  });

  it('reports stale NPC selections without retrying deleted NPCs or successful entries', async () => {
    mockSessionState.currentUser.isGm = true;
    mockMapState.npcInstances = [{ id: 'npc_1', displayName: 'Guard', mapId: 'map_1' }];
    const { result } = renderHook(() => useInitiative());
    const response = await result.current.addNpcInitiative(['npc_1', 'deleted'], 'fast', 'public', 0);
    expect(response.success).toBe(false);
    expect(response.failedIds).toEqual([]);
    expect(response.error).toContain('Added 1 NPCs; 1 failed to add');
    expect(response.error).toContain('no longer available');
  });

  it('preserves visibility for a GM phase-only change but allows an explicit GM visibility change', async () => {
    mockSessionState.currentUser.isGm = true;
    const { result } = renderHook(() => useInitiative());
    const source = { sourceType: 'player' as const, sourceId: 'char_1', sourceName: 'Kaladin' };
    await result.current.setPhaseForParticipant(source, 'slow');
    expect(updatePayload).toHaveBeenLastCalledWith({ phase: 'slow' });
    await result.current.setPhaseForParticipant(source, 'fast', 'public');
    expect(updatePayload).toHaveBeenLastCalledWith({ phase: 'fast', visibility: 'public' });
  });
});
