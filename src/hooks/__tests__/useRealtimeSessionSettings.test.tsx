/* @vitest-environment jsdom */
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRealtime, resetInitiativeRealtimeAvailabilityForTests } from '../useRealtime';
import { useMapStore } from '../../stores/mapStore';
import { useSessionStore } from '../../stores/sessionStore';
import type { DbSession, Map, Session } from '../../types';

const mocks = vi.hoisted(() => ({
  sessionUpdate: null as null | ((payload: { new: DbSession }) => void),
  load: vi.fn(),
}));
vi.mock('../useSession', () => ({ useSession: () => ({ loadSessionData: mocks.load }) }));
vi.mock('../../lib/supabase', () => ({ supabase: {
  channel: () => {
    const channel = {
      on: (_event: string, filter: { table?: string }, callback: typeof mocks.sessionUpdate) => {
        if (filter.table === 'sessions') mocks.sessionUpdate = callback;
        return channel;
      },
      subscribe: () => channel,
    };
    return channel;
  },
  removeChannel: vi.fn(),
  from: () => ({ select: () => ({ limit: async () => ({ error: { code: '42P01' } }) }) }),
} }));
vi.mock('../../lib/tokenBroadcast', () => ({
  getTokenBroadcastChannel: () => ({ on: vi.fn() }), clearTokenBroadcastChannel: vi.fn(),
}));

const maps = ['a', 'b'].map(id => ({ id, width: 1000, height: 800, drawingData: [] } as unknown as Map));
const update = (mapId: string, tokenOpacity: number) => act(() => mocks.sessionUpdate?.({ new: {
  id: 'table', active_map_id: mapId, token_opacity: tokenOpacity,
} as DbSession }));
const focusToken = () => useMapStore.setState({
  viewportScale: 1.93, viewportX: -120, viewportY: -80, selectedTokenId: 'Tama', selectedTokenType: 'character',
});
const expectFocus = () => expect(useMapStore.getState()).toMatchObject({
  viewportScale: 1.93, viewportX: -120, viewportY: -80, selectedTokenId: 'Tama', selectedTokenType: 'character',
});

beforeEach(() => {
  vi.useFakeTimers(); mocks.sessionUpdate = null;
  resetInitiativeRealtimeAvailabilityForTests();
  useSessionStore.setState({ session: { id: 'table', activeMapId: null, tokenOpacity: 1 } as Session,
    currentUser: { username: 'Player', isGm: false, characterId: null } });
  useMapStore.getState().clearMapState();
  useMapStore.setState({ maps, stageWidth: 1280, stageHeight: 900 });
});
afterEach(() => { cleanup(); vi.clearAllTimers(); vi.useRealTimers(); });

describe('realtime name transparency preserves the current map', () => {
  it('preserves zoom, selection and map identity when the map loaded after subscription', () => {
    renderHook(() => useRealtime());
    act(() => {
      useSessionStore.getState().updateSession({ activeMapId: 'a' });
      useMapStore.setState({ activeMap: maps[0] });
      focusToken();
    });
    for (const opacity of [0.5, 0, 1, 0, 1]) {
      update('a', opacity);
      act(() => vi.advanceTimersByTime(200));
      expect(useSessionStore.getState().session?.tokenOpacity).toBe(opacity);
      expect(useMapStore.getState().activeMap).toBe(maps[0]);
      expectFocus();
    }
  });

  it('switches maps when requested and preserves focus on subsequent settings updates', () => {
    useSessionStore.getState().updateSession({ activeMapId: 'a' });
    useMapStore.setState({ activeMap: maps[0] });
    renderHook(() => useRealtime());
    update('b', 0);
    expect(useMapStore.getState().activeMap?.id).toBe('b');
    act(() => { vi.advanceTimersByTime(200); focusToken(); });
    update('b', 1);
    act(() => vi.advanceTimersByTime(200));
    expectFocus();
    update('a', 1);
    expect(useMapStore.getState().activeMap?.id).toBe('a');
  });
});
