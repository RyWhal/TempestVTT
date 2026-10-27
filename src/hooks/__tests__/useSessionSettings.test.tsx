/* @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSession } from '../useSession';
import { useSessionStore } from '../../stores/sessionStore';
import type { Session } from '../../types';
const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));
vi.mock('../../lib/supabase', () => ({ supabase: { from: fromMock } }));
describe('shared token opacity settings', () => {
  beforeEach(() => {
    fromMock.mockReset();
    useSessionStore.setState({
      session: { id: 'opacity_session', tokenOpacity: 1 } as Session,
      currentUser: { username: 'GM', characterId: null, isGm: true },
    });
  });

  const updateSettings = async (settings: Parameters<ReturnType<typeof useSession>['updateSessionSettings']>[0]) => {
    const { result } = renderHook(() => useSession());
    let response!: Awaited<ReturnType<typeof result.current.updateSessionSettings>>;
    await act(async () => { response = await result.current.updateSessionSettings(settings); });
    return response;
  };

  it.each([0, 0.5, 1])('persists and applies shared opacity %s', async tokenOpacity => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    fromMock.mockReturnValue({ update });
    expect(await updateSettings({ tokenOpacity })).toEqual({ success: true });
    expect(update).toHaveBeenCalledWith({ token_opacity: tokenOpacity });
    expect(eq).toHaveBeenCalledWith('id', 'opacity_session');
    expect(useSessionStore.getState().session?.tokenOpacity).toBe(tokenOpacity);
  });

  it.each([-0.1, 1.1, Number.NaN, Infinity])('rejects invalid opacity %s before any write', async tokenOpacity => {
    expect(await updateSettings({ tokenOpacity })).toMatchObject({ success: false });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('rejects a player write and preserves committed opacity on database failure', async () => {
    act(() => useSessionStore.setState({ currentUser: { username: 'Player', isGm: false, characterId: null } }));
    expect(await updateSettings({ tokenOpacity: 0 })).toMatchObject({ success: false });
    expect(fromMock).not.toHaveBeenCalled();
    act(() => useSessionStore.setState({ currentUser: { username: 'GM', isGm: true, characterId: null } }));
    fromMock.mockReturnValue({ update: () => ({ eq: async () => ({ error: { message: 'save failed' } }) }) });
    expect(await updateSettings({ tokenOpacity: 0 })).toMatchObject({ success: false });
    expect(useSessionStore.getState().session?.tokenOpacity).toBe(1);
  });
});
