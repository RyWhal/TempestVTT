import { beforeEach, describe, expect, it } from 'vitest';
import { useChatStore } from './chatStore';
import type { DiceRoll } from '../types';

const roll = (id: string): DiceRoll => ({
  id, sessionId: 'table', username: 'Kaladin', characterName: null,
  rollExpression: 'd20', rollResults: { dice: [{ type: 'd20', count: 1, results: [17] }], modifier: 0, total: 17 },
  visibility: 'public', plotDiceResults: null, createdAt: '2026-09-17T00:00:00Z',
});

beforeEach(() => useChatStore.getState().clearChatState());
describe('roll animation delivery', () => {
  it('keeps remote results in history without animations, including bursts', () => {
    for (let i = 0; i < 12; i++) useChatStore.getState().addDiceRoll(roll(String(i)), false);
    expect(useChatStore.getState().diceRolls).toHaveLength(12);
    expect(useChatStore.getState().rollAnimationQueue).toEqual([]);
    expect(useChatStore.getState().isNewRollAnimating).toBe(false);
  });
  it('animates locally once even when the realtime echo arrives first', () => {
    const store = useChatStore.getState();
    store.addDiceRoll(roll('own'), false);
    store.addDiceRoll(roll('own'));
    store.addDiceRoll(roll('own'), false);
    expect(useChatStore.getState().diceRolls).toHaveLength(1);
    expect(useChatStore.getState().rollAnimationQueue.map(r => r.id)).toEqual(['own']);
    store.finishRollAnimation('own');
    store.addDiceRoll(roll('own'), false);
    store.addDiceRoll(roll('own'));
    expect(useChatStore.getState().rollAnimationQueue).toEqual([]);
  });
  it('does not replay hydrated history or its duplicate broadcasts', () => {
    useChatStore.getState().setDiceRolls([roll('old')]);
    useChatStore.getState().addDiceRoll(roll('old'));
    expect(useChatStore.getState().rollAnimationQueue).toEqual([]);
  });
  it('animates a new roll once across local, broadcast, and database delivery', () => {
    useChatStore.getState().addDiceRoll(roll('new'));
    useChatStore.getState().addDiceRoll(roll('new'));
    expect(useChatStore.getState().rollAnimationQueue.map(r => r.id)).toEqual(['new']);
    useChatStore.getState().finishRollAnimation('new');
    useChatStore.getState().setDiceRolls([]);
    useChatStore.getState().addDiceRoll(roll('new'));
    expect(useChatStore.getState().rollAnimationQueue).toEqual([]);
  });
  it('preserves the active roll and newest pending rolls in a bounded queue', () => {
    for (let i = 0; i < 12; i++) useChatStore.getState().addDiceRoll(roll(String(i)));
    expect(useChatStore.getState().rollAnimationQueue.map(r => r.id)).toEqual(['0', '5', '6', '7', '8', '9', '10', '11']);
    expect(useChatStore.getState().diceRolls).toHaveLength(12);
    useChatStore.getState().finishRollAnimation('5');
    expect(useChatStore.getState().rollAnimationQueue[0].id).toBe('0');
  });
  it('clears queued animation with history and resets deduplication on leaving', () => {
    useChatStore.getState().addDiceRoll(roll('new'));
    useChatStore.getState().clearDiceRolls();
    expect(useChatStore.getState().rollAnimationQueue).toEqual([]);
    useChatStore.getState().addDiceRoll(roll('new'));
    expect(useChatStore.getState().rollAnimationQueue).toEqual([]);
    useChatStore.getState().clearChatState();
    useChatStore.getState().addDiceRoll(roll('new'));
    expect(useChatStore.getState().rollAnimationQueue).toHaveLength(1);
  });
});
