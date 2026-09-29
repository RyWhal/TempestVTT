/* @vitest-environment jsdom */
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlayerAccentReservations } from '../usePlayerAccents';
import { useSessionStore } from '../../stores/sessionStore';
import { usePlayerAccentsStore } from '../../stores/playerAccentsStore';
import { accentForPlayer, NEUTRAL_ACCENT, PLAYER_ACCENTS } from '../../lib/playerAccents';
const { rpc, channel, refresh } = vi.hoisted(() => ({ rpc: vi.fn(), refresh: vi.fn(), channel: { on: vi.fn(), subscribe: vi.fn() } }));
vi.mock('../../lib/supabase', () => ({ supabase: { rpc, channel: () => channel, removeChannel: vi.fn(), from: () => ({ select: () => ({ eq: refresh }) }) } }));
const lease = { username: 'Kaladin', color: '#60a5fa', expires_at: '2099-01-01T00:00:00Z' };
describe('player accent leases', () => {
  beforeEach(() => {
    vi.useFakeTimers(); rpc.mockReset(); rpc.mockResolvedValue({ data: [lease], error: null });
    channel.on.mockClear().mockReturnValue(channel); channel.subscribe.mockReturnValue(channel);
    usePlayerAccentsStore.getState().reset();
    useSessionStore.setState({ session: { id: 'table' } as never, currentUser: { username: 'Kaladin', characterId: null, isGm: false }, connectionStatus: 'connected' });
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });
  it('claims an available default and renews only while connected', async () => {
    renderHook(() => usePlayerAccentReservations());
    await act(async () => {});
    expect(rpc).toHaveBeenCalledWith('claim_player_accent', { p_session_id: 'table', p_username: 'Kaladin', p_color: null });
    expect(usePlayerAccentsStore.getState().reservations[0].color).toBe('#60a5fa');
    await act(async () => { vi.advanceTimersByTime(60_000); });
    expect(rpc).toHaveBeenCalledTimes(2);
    act(() => useSessionStore.setState({ connectionStatus: 'disconnected' }));
    await act(async () => { vi.advanceTimersByTime(120_000); });
    expect(rpc).toHaveBeenCalledTimes(2);
  });
  it('retains the existing color when another client wins the selection race', async () => {
    const { result } = renderHook(() => usePlayerAccentReservations());
    await act(async () => {});
    rpc.mockResolvedValue({ data: null, error: { message: 'That color has just been taken.' } });
    await act(async () => { await result.current('#f472b6'); });
    expect(usePlayerAccentsStore.getState().reservations[0].color).toBe('#60a5fa');
    expect(usePlayerAccentsStore.getState().error).toContain('taken');
  });
  it('ignores a response after changing sessions', async () => {
    let resolve!: (value: unknown) => void;
    rpc.mockReturnValue(new Promise((done) => { resolve = done; }));
    const { unmount } = renderHook(() => usePlayerAccentReservations());
    unmount();
    useSessionStore.setState({ session: { id: 'other' } as never });
    await act(async () => { resolve({ data: [lease], error: null }); });
    expect(usePlayerAccentsStore.getState().reservations).toEqual([]);
  });
  it('uses neutral for expired reservations and keeps palette values unique', () => {
    expect(accentForPlayer([{ username: 'Kaladin', color: '#60a5fa', expiresAt: '2000-01-01' }], 'Kaladin')).toBe(NEUTRAL_ACCENT);
    expect(new Set(PLAYER_ACCENTS.map((entry) => entry[1])).size).toBe(PLAYER_ACCENTS.length);
  });
  it('handles a realtime refresh network rejection without losing the last color', async () => {
    renderHook(() => usePlayerAccentReservations());
    await act(async () => {});
    refresh.mockRejectedValue(new Error('Network offline'));
    const callback = channel.on.mock.calls[0][2];
    await act(async () => { await callback(); });
    expect(usePlayerAccentsStore.getState().reservations[0].color).toBe('#60a5fa');
    expect(usePlayerAccentsStore.getState().error).toContain('Unable to refresh');
  });
});
