/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useChat } from '../useChat';

const {
  fromMock,
  addDiceRollMock,
  clearDiceRollsMock,
  resetUnreadMock,
  broadcastDiceRollMock,
  broadcastDiceRollHistoryClearedMock,
  mockSessionState,
  mockChatState,
} = vi.hoisted(() => ({
  fromMock: vi.fn(),
  addDiceRollMock: vi.fn(),
  clearDiceRollsMock: vi.fn(),
  resetUnreadMock: vi.fn(),
  broadcastDiceRollMock: vi.fn(),
  broadcastDiceRollHistoryClearedMock: vi.fn(),
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
  mockChatState: {
    messages: [],
    diceRolls: [],
    addMessage: vi.fn(),
    addDiceRoll: vi.fn(),
    clearDiceRolls: vi.fn(),
    resetUnread: vi.fn(),
  },
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: fromMock,
  },
}));

vi.mock('../../stores/sessionStore', () => ({
  useSessionStore: (selector?: (state: typeof mockSessionState) => unknown) =>
    selector ? selector(mockSessionState) : mockSessionState,
}));

vi.mock('../../stores/chatStore', () => ({
  useChatStore: (selector?: (state: typeof mockChatState) => unknown) =>
    selector ? selector(mockChatState) : mockChatState,
}));

vi.mock('../../lib/tokenBroadcast', () => ({
  broadcastChatMessage: vi.fn(),
  broadcastDiceRoll: broadcastDiceRollMock,
  broadcastDiceRollHistoryCleared: broadcastDiceRollHistoryClearedMock,
}));

describe('useChat', () => {
  beforeEach(() => {
    fromMock.mockReset();
    addDiceRollMock.mockReset();
    clearDiceRollsMock.mockReset();
    resetUnreadMock.mockReset();
    broadcastDiceRollMock.mockReset();
    broadcastDiceRollHistoryClearedMock.mockReset();

    mockSessionState.currentUser.isGm = false;

    mockChatState.addDiceRoll = addDiceRollMock;
    mockChatState.clearDiceRolls = clearDiceRollsMock;
    mockChatState.resetUnread = resetUnreadMock;
  });

  it('rejects invalid modifier-only rolls before inserting anything', async () => {
    const { result } = renderHook(() => useChat());

    let response: Awaited<ReturnType<typeof result.current.rollDice>> | undefined;
    await act(async () => {
      response = await result.current.rollDice('+2');
    });

    expect(response).toEqual({
      success: false,
      error: 'Select at least one die to roll.',
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('stores structured advantage roll metadata and keeps the visible roll in local state', async () => {
    let insertedPayload: Record<string, unknown> | null = null;
    const insertSingleMock = vi.fn(async () => ({
      data: {
        id: 'roll_001',
        session_id: 'session_001',
        username: 'Kaladin',
        character_name: 'Sir Henry',
        roll_expression: '1d20+2',
        roll_results: insertedPayload?.roll_results,
        visibility: 'public',
        plot_dice_results: insertedPayload?.plot_dice_results,
        created_at: '2026-04-08T15:00:00.000Z',
      },
      error: null,
    }));
    const insertMock = vi.fn((payload: Record<string, unknown>) => {
      insertedPayload = payload;
      return {
        select: vi.fn().mockReturnValue({
          single: insertSingleMock,
        }),
      };
    });

    fromMock.mockImplementation((table: string) => {
      if (table === 'dice_rolls') {
        return {
          insert: insertMock,
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.95)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.95);

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.rollDice('1d20+2', {
        visibility: 'public',
        plotDieEnabled: true,
        mode: 'advantage',
        characterName: 'Sir Henry',
      });
    });

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        session_id: 'session_001',
        username: 'Kaladin',
        character_name: 'Sir Henry',
        roll_expression: '1d20+2',
        roll_results: expect.objectContaining({
          mode: 'advantage',
          attempts: expect.any(Array),
          keptAttemptIndex: expect.any(Number),
        }),
        plot_dice_results: [
          expect.objectContaining({
            face: 'complication_bonus_4',
            bonus: 4,
          }),
        ],
      })
    );
    expect(addDiceRollMock).toHaveBeenCalledTimes(1);
    expect(broadcastDiceRollMock).toHaveBeenCalledTimes(1);
  });

  it('lets the GM clear dice history for the current session', async () => {
    mockSessionState.currentUser.isGm = true;

    const deleteBySessionMock = vi.fn().mockResolvedValue({ error: null });
    const deleteMock = vi.fn().mockReturnValue({
      eq: deleteBySessionMock,
    });

    fromMock.mockImplementation((table: string) => {
      if (table === 'dice_rolls') {
        return {
          delete: deleteMock,
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const { result } = renderHook(() => useChat());

    let response: Awaited<ReturnType<typeof result.current.clearDiceHistory>> | undefined;
    await act(async () => {
      response = await result.current.clearDiceHistory();
    });

    expect(response).toEqual({ success: true });
    expect(deleteBySessionMock).toHaveBeenCalledWith('session_id', 'session_001');
    expect(clearDiceRollsMock).toHaveBeenCalledTimes(1);
    expect(broadcastDiceRollHistoryClearedMock).toHaveBeenCalledWith({
      sessionId: 'session_001',
    });
  });

  it('resolves the roll once persistence succeeds even if the broadcast never settles', async () => {
    let insertedPayload: Record<string, unknown> | null = null;
    const insertSingleMock = vi.fn(async () => ({
      data: {
        id: 'roll_002',
        session_id: 'session_001',
        username: 'Kaladin',
        character_name: 'Sir Henry',
        roll_expression: '1d20+2',
        roll_results: insertedPayload?.roll_results,
        visibility: 'public',
        plot_dice_results: insertedPayload?.plot_dice_results,
        created_at: '2026-04-08T15:00:00.000Z',
      },
      error: null,
    }));
    const insertMock = vi.fn((payload: Record<string, unknown>) => {
      insertedPayload = payload;
      return {
        select: vi.fn().mockReturnValue({
          single: insertSingleMock,
        }),
      };
    });

    fromMock.mockImplementation((table: string) => {
      if (table === 'dice_rolls') {
        return {
          insert: insertMock,
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    broadcastDiceRollMock.mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useChat());

    let settled = false;
    const rollPromise = result.current.rollDice('1d20+2', {
      visibility: 'public',
      characterName: 'Sir Henry',
    }).then(() => {
      settled = true;
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(settled).toBe(true);
    await rollPromise;
  });
});
