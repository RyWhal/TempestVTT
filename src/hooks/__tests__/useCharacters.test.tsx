/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCharacters } from '../useCharacters';

const {
  fromMock,
  updateCharacterMock,
  renameSourceMock,
  mockSessionState,
  mockMapState,
  updateCharacterById,
  updateInitiativeEntryBySourceId,
  updateInitiativeLogBySourceId,
} = vi.hoisted(() => ({
  fromMock: vi.fn(),
  updateCharacterMock: vi.fn(),
  renameSourceMock: vi.fn(),
  mockSessionState: {
    session: {
      id: 'session_001',
      code: 'ABCD12',
      name: 'Shared Table',
    },
    currentUser: {
      username: 'Kaladin',
      characterId: 'char_1',
      isGm: false,
    },
  },
  mockMapState: {
    activeMap: null,
    characters: [
      {
        id: 'char_1',
        sessionId: 'session_001',
        name: 'Kaladin',
        tokenUrl: null,
        size: 'medium',
        statusRingColor: null,
        positionX: 100,
        positionY: 100,
        isClaimed: true,
        claimedByUsername: 'Kaladin',
        inventory: [],
        notes: '',
        createdAt: '2026-04-01T00:00:00.000Z',
      },
    ],
    addCharacter: vi.fn(),
    updateCharacter: vi.fn(),
    removeCharacter: vi.fn(),
    moveCharacter: vi.fn(),
  },
  updateCharacterById: vi.fn(),
  updateInitiativeEntryBySourceId: vi.fn(),
  updateInitiativeLogBySourceId: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: fromMock,
  },
  uploadFile: vi.fn(),
  deleteFile: vi.fn(),
  STORAGE_BUCKETS: {
    TOKENS: 'tokens',
  },
}));

vi.mock('../../stores/sessionStore', () => ({
  useSessionStore: (selector?: (state: typeof mockSessionState) => unknown) =>
    selector ? selector(mockSessionState) : mockSessionState,
}));

vi.mock('../../stores/mapStore', () => ({
  useMapStore: (selector?: (state: typeof mockMapState) => unknown) =>
    selector ? selector(mockMapState) : mockMapState,
}));

vi.mock('../../stores/initiativeStore', () => ({
  useInitiativeStore: (selector: (state: { renameSource: typeof renameSourceMock }) => unknown) =>
    selector({
      renameSource: renameSourceMock,
    }),
}));

vi.mock('nanoid', () => ({
  nanoid: () => 'generated-id',
}));

vi.mock('../../lib/tokenBroadcast', () => ({
  broadcastTokenMove: vi.fn(),
}));

describe('useCharacters', () => {
  beforeEach(() => {
    fromMock.mockReset();
    updateCharacterMock.mockReset();
    renameSourceMock.mockReset();
    updateCharacterById.mockReset();
    updateInitiativeEntryBySourceId.mockReset();
    updateInitiativeLogBySourceId.mockReset();

    mockMapState.updateCharacter = updateCharacterMock;

    updateCharacterById.mockResolvedValue({ error: null });
    updateInitiativeEntryBySourceId.mockResolvedValue({ error: null });
    updateInitiativeLogBySourceId.mockResolvedValue({ error: null });

    fromMock.mockImplementation((table: string) => {
      if (table === 'characters') {
        return {
          update: vi.fn().mockReturnValue({
            eq: updateCharacterById,
          }),
        };
      }

      if (table === 'initiative_entries') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: updateInitiativeEntryBySourceId,
            }),
          }),
        };
      }

      if (table === 'initiative_roll_logs') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: updateInitiativeLogBySourceId,
            }),
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });
  });

  it('propagates renamed PCs into initiative entries and initiative roll logs', async () => {
    const { result } = renderHook(() => useCharacters());

    let response: Awaited<ReturnType<typeof result.current.updateCharacterDetails>> | undefined;
    await act(async () => {
      response = await result.current.updateCharacterDetails('char_1', {
        name: 'Sir Henry',
      });
    });

    expect(response).toEqual({ success: true });
    expect(updateCharacterById).toHaveBeenCalledWith('id', 'char_1');
    expect(updateInitiativeEntryBySourceId).toHaveBeenCalledWith('source_id', 'char_1');
    expect(updateInitiativeLogBySourceId).toHaveBeenCalledWith('source_id', 'char_1');
    expect(updateCharacterMock).toHaveBeenCalledWith('char_1', {
      name: 'Sir Henry',
    });
    expect(renameSourceMock).toHaveBeenCalledWith('player', 'char_1', 'Sir Henry');
  });
});
