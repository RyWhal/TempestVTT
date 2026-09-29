// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSharedMeasurements } from './useSharedMeasurements';

const transport = vi.hoisted(() => ({
  receive: null as null | ((message: { payload: unknown }) => void),
  subscribe: null as null | ((status: string) => void),
  send: vi.fn(), remove: vi.fn(),
}));
vi.mock('../lib/supabase', () => ({ supabase: {
  channel: () => {
    const channel = {
      on: (_: string, __: unknown, receive: typeof transport.receive) => { transport.receive = receive; return channel; },
      subscribe: (subscribe: typeof transport.subscribe) => { transport.subscribe = subscribe; return channel; },
      send: transport.send,
    };
    return channel;
  }, removeChannel: transport.remove,
} }));

const options = { sessionId: 'table', mapId: 'map', owner: 'Kaladin', privateMeasurement: false };
const remote = (changes = {}) => ({ sessionId: 'table', mapId: 'map', owner: 'Shallan', id: 'remote',
  shape: 'cone', start: { x: 0, y: 0 }, end: { x: 200, y: 150 }, startedAt: Date.now(),
  sentAt: Date.now(), phase: 'dragging', sequence: 1, ...changes });

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(100_000); transport.send.mockReset().mockResolvedValue('ok'); });
afterEach(() => vi.useRealTimers());

describe('shared measurement lifecycle', () => {
  it('throttles dragging but sends the latest endpoint immediately on release and expires after 10 seconds', () => {
    const { result, unmount } = renderHook(() => useSharedMeasurements(options));
    act(() => { transport.subscribe?.('SUBSCRIBED'); result.current.begin({ x: 0, y: 0 }, 'radius'); });
    act(() => { for (let x = 1; x < 50; x++) result.current.move({ x, y: 10 }); });
    expect(transport.send).toHaveBeenCalledTimes(1);
    act(() => result.current.release());
    expect(transport.send).toHaveBeenCalledTimes(2);
    expect(transport.send.mock.calls[1][0].payload).toMatchObject({ phase: 'released', end: { x: 49, y: 10 } });
    act(() => vi.advanceTimersByTime(9_900));
    expect(result.current.measurements).toHaveLength(1);
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.measurements).toHaveLength(0);
    unmount();
  });

  it('dismisses only its own measurement and prevents out-of-order packets from resurrecting remote ones', () => {
    const { result, unmount } = renderHook(() => useSharedMeasurements(options));
    const packet = remote();
    act(() => { transport.subscribe?.('SUBSCRIBED'); transport.receive?.({ payload: packet }); result.current.begin({ x: 0, y: 0 }, 'line'); });
    act(() => result.current.dismiss());
    act(() => vi.advanceTimersByTime(400));
    expect(result.current.measurements.map((m) => m.owner)).toEqual(['Shallan']);
    act(() => {
      transport.receive?.({ payload: { ...packet, phase: 'dismissed', sequence: 3 } });
      transport.receive?.({ payload: { ...packet, sequence: 2 } });
      vi.advanceTimersByTime(400);
    });
    expect(result.current.measurements).toHaveLength(0);
    unmount();
  });

  it('keeps private gestures local and retracts a public gesture when privacy changes', () => {
    const { result, rerender, unmount } = renderHook((props) => useSharedMeasurements(props), { initialProps: options });
    act(() => { transport.subscribe?.('SUBSCRIBED'); result.current.begin({ x: 0, y: 0 }, 'line'); });
    rerender({ ...options, privateMeasurement: true });
    expect(transport.send.mock.calls[transport.send.mock.calls.length - 1]?.[0].payload.phase).toBe('dismissed');
    transport.send.mockClear();
    act(() => { result.current.begin({ x: 1, y: 1 }, 'cone'); result.current.move({ x: 50, y: 50 }); result.current.release(); });
    expect(transport.send).not.toHaveBeenCalled();
    expect(result.current.measurements[0].private).toBe(true);
    unmount();
  });

  it('ends drags released outside the canvas and cancels on blur', () => {
    const { result, unmount } = renderHook(() => useSharedMeasurements(options));
    act(() => { transport.subscribe?.('SUBSCRIBED'); result.current.begin({ x: 0, y: 0 }, 'line'); result.current.move({ x: 30, y: 0 }); });
    act(() => window.dispatchEvent(new Event('pointerup')));
    expect(result.current.measurements[0].phase).toBe('released');
    act(() => window.dispatchEvent(new Event('blur')));
    expect(transport.send.mock.calls[transport.send.mock.calls.length - 1]?.[0].payload.phase).toBe('dismissed');
    unmount();
  });

  it('expires disconnected drags, rejects other maps and preserves released expiry across delayed delivery', () => {
    const { result, unmount } = renderHook(() => useSharedMeasurements(options));
    act(() => {
      transport.receive?.({ payload: remote({ mapId: 'other' }) });
      transport.receive?.({ payload: remote() });
    });
    expect(result.current.measurements).toHaveLength(1);
    act(() => vi.advanceTimersByTime(4400));
    expect(result.current.measurements).toHaveLength(0);
    act(() => transport.receive?.({ payload: remote({ id: 'release', phase: 'released', sentAt: Date.now() - 9000 }) }));
    expect(result.current.measurements).toHaveLength(1);
    act(() => vi.advanceTimersByTime(1400));
    expect(result.current.measurements).toHaveLength(0);
    unmount();
  });
});
