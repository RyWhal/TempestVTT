// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatStore } from '../../stores/chatStore';
import { useDiceSettingsStore } from '../../stores/diceSettingsStore';
import type { DiceRoll } from '../../types';

const { sessionState, rendererMock } = vi.hoisted(() => ({
  sessionState: { session: { id: 'table' }, currentUser: { username: 'Kaladin', isGm: false } },
  rendererMock: vi.fn(),
}));
vi.mock('../../stores/sessionStore', () => ({ useSessionStore: (select: (s: typeof sessionState) => unknown) => select(sessionState) }));
vi.mock('./diceRenderer', () => ({ createDiceRenderer: rendererMock }));
import { DiceRollOverlay } from './DiceRollOverlay';

const makeRoll = (id = 'new', visibility: DiceRoll['visibility'] = 'public'): DiceRoll => ({
  id, sessionId: 'table', username: 'Kaladin', characterName: null,
  rollExpression: '1d20+3', rollResults: { dice: [{ type: 'd20', count: 1, results: [17] }], modifier: 3, total: 20 },
  visibility, plotDiceResults: null, createdAt: '',
});
let reduceMotion = true;
beforeEach(() => {
  vi.useFakeTimers();
  useChatStore.getState().clearChatState();
  useDiceSettingsStore.getState().setShowDiceAnimations(true);
  sessionState.currentUser = { username: 'Kaladin', isGm: false };
  reduceMotion = true;
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: reduceMotion, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  rendererMock.mockReset();
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

async function flush() { await act(async () => { await Promise.resolve(); }); }
async function finish(hold = 12000) {
  await act(async () => { await vi.advanceTimersByTimeAsync(hold); });
  await act(async () => { await vi.advanceTimersByTimeAsync(350); });
}

describe('map roll overlay', () => {
  it('reveals history at final settlement rather than when the animation starts or fades', async () => {
    reduceMotion = false;
    let settle = () => {};
    rendererMock.mockImplementation((_host, _dice, callbacks) => {
      settle = callbacks.onSettled;
      return { dispose: vi.fn() };
    });
    const roll = makeRoll();
    roll.rollResults.dice = [{ type: 'd6', count: 21, results: Array(21).fill(4) }];
    roll.rollResults.total = 84;
    useChatStore.getState().addDiceRoll(roll);
    const view = render(<DiceRollOverlay drawerOpen={false} />);
    await flush();
    act(() => settle());
    expect(useChatStore.getState().revealedRollId).toBeNull();
    expect(view.container.querySelector('.map-dice-total strong')?.textContent).toBe('…');
    await finish(1800);
    await flush();
    expect(useChatStore.getState().revealedRollId).toBeNull();
    act(() => settle());
    expect(useChatStore.getState().revealedRollId).toBe(roll.id);
    expect(view.container.querySelector('.map-dice-total strong')?.textContent).toBe('84');
    expect(useChatStore.getState().rollAnimationQueue).toHaveLength(1);
  });

  it('does not spoil the kept attempt or final result before both attempts settle', async () => {
    reduceMotion = false;
    rendererMock.mockImplementation((_host, _dice, callbacks) => {
      callbacks.onSettled();
      return { dispose: vi.fn() };
    });
    const roll = makeRoll();
    roll.rollResults.mode = 'advantage';
    roll.rollResults.keptAttemptIndex = 0;
    roll.rollResults.attempts = [17, 4].map(value => ({ dice: [{ type: 'd20', count: 1, results: [value] }], modifier: 3, subtotal: value, total: value + 3, plotDie: null }));
    useChatStore.getState().addDiceRoll(roll);
    render(<DiceRollOverlay drawerOpen={false} />);
    await flush();
    expect(screen.queryByText('Kept')).toBeNull();
    expect(screen.queryByText(/Final result/)).toBeNull();
    await finish(1800);
    await flush();
    expect(screen.getByText(/Final result/).textContent).toContain('20');
    expect(useChatStore.getState().revealedRollId).toBe(roll.id);
  });

  it('does not animate or display loaded history', () => {
    useChatStore.getState().setDiceRolls([makeRoll()]);
    render(<DiceRollOverlay drawerOpen={false} />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(rendererMock).not.toHaveBeenCalled();
  });
  it('shows static results with reduced motion and drains the queue', async () => {
    useChatStore.getState().addDiceRoll(makeRoll());
    render(<DiceRollOverlay drawerOpen={false} />);
    await flush();
    expect(screen.getByRole('status').textContent).toContain('d20: 17');
    expect(screen.getByRole('status').textContent).toContain('20');
    expect(rendererMock).not.toHaveBeenCalled();
    await finish();
    expect(screen.queryByRole('status')).toBeNull();
    expect(useChatStore.getState().rollAnimationQueue).toHaveLength(0);
  });
  it('does not reveal GM-only rolls and immediately hides them on role loss', async () => {
    useChatStore.getState().addDiceRoll(makeRoll('secret', 'gm_only'));
    const view = render(<DiceRollOverlay drawerOpen={false} />);
    expect(screen.queryByRole('status')).toBeNull();
    sessionState.currentUser = { username: 'Kaladin', isGm: true };
    act(() => useChatStore.getState().addDiceRoll(makeRoll('gm-secret', 'gm_only')));
    view.rerender(<DiceRollOverlay drawerOpen={false} />);
    await flush();
    expect(screen.getByRole('status')).toBeTruthy();
    sessionState.currentUser = { username: 'Kaladin', isGm: false };
    view.rerender(<DiceRollOverlay drawerOpen={false} />);
    expect(screen.queryByRole('status')).toBeNull();
  });
  it('falls back to readable results when WebGL cannot initialize', async () => {
    reduceMotion = false;
    rendererMock.mockImplementation(() => { throw new Error('No WebGL'); });
    useChatStore.getState().addDiceRoll(makeRoll());
    render(<DiceRollOverlay drawerOpen={true} />);
    await flush();
    expect(rendererMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status').textContent).toContain('d20: 17');
    await finish();
    expect(screen.queryByRole('status')).toBeNull();
  });
  it('disposes the renderer and completes all batches before the next roll', async () => {
    reduceMotion = false;
    const dispose = vi.fn();
    rendererMock.mockImplementation((_host, _dice, callbacks) => { callbacks.onSettled(); return { dispose }; });
    const large = makeRoll('large');
    large.rollResults.dice = [{ type: 'd6', count: 21, results: Array(21).fill(4) }];
    useChatStore.getState().addDiceRoll(large);
    useChatStore.getState().addDiceRoll(makeRoll('next'));
    render(<DiceRollOverlay drawerOpen={false} />);
    await flush();
    expect(rendererMock.mock.calls[0][1]).toHaveLength(20);
    await finish(1800);
    await flush();
    expect(rendererMock.mock.calls[1][1]).toHaveLength(1);
    expect(useChatStore.getState().rollAnimationQueue[0].id).toBe('large');
    expect(dispose).toHaveBeenCalledTimes(1);
    await finish();
    await flush();
    expect(useChatStore.getState().rollAnimationQueue[0].id).toBe('next');
  });
  it('cleans up an active renderer when history is cleared', async () => {
    reduceMotion = false;
    const dispose = vi.fn();
    rendererMock.mockReturnValue({ dispose });
    useChatStore.getState().addDiceRoll(makeRoll());
    render(<DiceRollOverlay drawerOpen={false} />);
    await flush();
    act(() => useChatStore.getState().clearDiceRolls());
    expect(dispose).toHaveBeenCalledOnce();
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('renderer recovery', () => {
  it('switches to static results on context loss and completes the roll', async () => {
    reduceMotion = false;
    const dispose = vi.fn();
    let fail: () => void = () => {};
    rendererMock.mockImplementation((_host, _dice, callbacks) => { fail = callbacks.onError; return { dispose }; });
    useChatStore.getState().addDiceRoll(makeRoll());
    render(<DiceRollOverlay drawerOpen={false} />);
    await flush();
    act(() => fail());
    expect(screen.getByRole('status').textContent).toContain('d20: 17');
    expect(dispose).toHaveBeenCalled();
    await finish();
    expect(useChatStore.getState().rollAnimationQueue).toHaveLength(0);
  });
  it('recovers a stalled renderer and ignores its late completion callback', async () => {
    reduceMotion = false;
    const dispose = vi.fn();
    let lateCompletion: () => void = () => {};
    rendererMock.mockImplementation((_host, _dice, callbacks) => { lateCompletion = callbacks.onSettled; return { dispose }; });
    useChatStore.getState().addDiceRoll(makeRoll());
    render(<DiceRollOverlay drawerOpen={false} />);
    await flush();
    await act(async () => { await vi.advanceTimersByTimeAsync(8000); });
    expect(screen.getByRole('status').textContent).toContain('d20: 17');
    act(() => lateCompletion());
    expect(document.querySelector('.map-dice-roll')?.getAttribute('data-phase')).toBe('fallback');
    expect(dispose).toHaveBeenCalled();
    await finish();
    expect(useChatStore.getState().rollAnimationQueue).toHaveLength(0);
  });
});


describe('player animation preferences and dismissal', () => {
  it('holds the final result for 12 seconds before fading', async () => {
    useChatStore.getState().addDiceRoll(makeRoll());
    render(<DiceRollOverlay drawerOpen={false} />);
    await flush();
    await act(async () => { await vi.advanceTimersByTimeAsync(11999); });
    expect(screen.getByRole('status')).toBeTruthy();
    await finish(1);
    expect(screen.queryByRole('status')).toBeNull();
  });
  it('dismisses the current roll on an outside click without blocking the clicked control', async () => {
    const clicked = vi.fn();
    useChatStore.getState().addDiceRoll(makeRoll());
    render(<><button onClick={clicked}>Map control</button><DiceRollOverlay drawerOpen={false} /></>);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Map control' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(350); });
    expect(clicked).toHaveBeenCalledOnce();
    expect(screen.queryByRole('status')).toBeNull();
  });
  it('discards pending visuals when disabled, preserving roll history and future rolling', async () => {
    useChatStore.getState().addDiceRoll(makeRoll());
    const view = render(<DiceRollOverlay drawerOpen={false} />);
    await flush();
    act(() => useDiceSettingsStore.getState().setShowDiceAnimations(false));
    expect(screen.queryByRole('status')).toBeNull();
    expect(useChatStore.getState().rollAnimationQueue).toHaveLength(0);
    expect(useChatStore.getState().diceRolls).toHaveLength(1);
    act(() => useChatStore.getState().addDiceRoll(makeRoll('off')));
    expect(useChatStore.getState().rollAnimationQueue).toHaveLength(0);
    act(() => useDiceSettingsStore.getState().setShowDiceAnimations(true));
    view.rerender(<DiceRollOverlay drawerOpen={false} />);
    expect(screen.queryByRole('status')).toBeNull();
    act(() => useChatStore.getState().addDiceRoll(makeRoll('enabled')));
    await flush();
    expect(screen.getByRole('status')).toBeTruthy();
  });
});

it('dismisses all remaining batches of the current roll and keeps the next roll', async () => {
  const large = makeRoll('large');
  large.rollResults.dice = [{ type: 'd6', count: 21, results: Array(21).fill(4) }];
  useChatStore.getState().addDiceRoll(large);
  useChatStore.getState().addDiceRoll(makeRoll('next'));
  render(<DiceRollOverlay drawerOpen={false} />);
  await flush();
  fireEvent.click(document.body);
  await act(async () => { await vi.advanceTimersByTimeAsync(350); });
  expect(useChatStore.getState().rollAnimationQueue.map(roll => roll.id)).toEqual(['next']);
  expect(screen.getByRole('status').textContent).toContain('1d20+3');
});

it('keeps the result visible when a pointer click falls within the click-through card', async () => {
  useChatStore.getState().addDiceRoll(makeRoll());
  render(<DiceRollOverlay drawerOpen={false} />);
  await flush();
  vi.spyOn(screen.getByRole('status'), 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 100, 300, 100));
  fireEvent.click(document.body, { detail: 1, clientX: 150, clientY: 150 });
  expect(document.querySelector('.map-dice-roll')?.getAttribute('data-phase')).toBe('fallback');
  fireEvent.click(document.body, { detail: 1, clientX: 500, clientY: 500 });
  await act(async () => { await vi.advanceTimersByTimeAsync(350); });
  expect(screen.queryByRole('status')).toBeNull();
});
