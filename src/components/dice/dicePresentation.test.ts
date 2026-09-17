import { describe, expect, it } from 'vitest';
import { buildRollPresentation, canViewRoll } from './dicePresentation';
import type { DiceRoll, RollAttempt } from '../../types';

const makeRoll = (dice = [{ type: 'd20', count: 1, results: [17] }]): DiceRoll => ({
  id: 'roll', sessionId: 'table', username: 'Kaladin', characterName: null,
  rollExpression: 'mixed', rollResults: { dice, modifier: 3, total: 20 },
  visibility: 'public', plotDiceResults: null, createdAt: '',
});

describe('roll presentation', () => {
  it('preserves every value and uses the actual polyhedron', () => {
    const roll = makeRoll([4, 6, 8, 10, 12, 20].map(n => ({ type: `d${n}`, count: 2, results: [1, n] })));
    const result = buildRollPresentation(roll);
    expect(result.batches[0].dice.map(d => [d.sides, d.value])).toEqual([4, 6, 8, 10, 12, 20].flatMap(n => [[n, 1], [n, n]]));
    expect(result.total).toBe(20); // Saved total is authoritative, including modifiers.
  });
  it('represents percentile 1, 10, and 100 as tens and units, with 00 + 0 = 100', () => {
    const dice = buildRollPresentation(makeRoll([{ type: 'd100', count: 3, results: [1, 10, 100] }])).batches[0].dice;
    expect(dice.map(d => d.label)).toEqual(['00', '1', '10', '0', '00', '0']);
    expect(dice.map(d => d.value)).toEqual([10, 1, 1, 10, 10, 10]);
    expect(dice.every(d => d.sides === 10)).toBe(true);
  });
  it('keeps percentile pairs together at batch boundaries and never exceeds 20', () => {
    const batches = buildRollPresentation(makeRoll([
      { type: 'd6', count: 19, results: Array(19).fill(4) },
      { type: 'd100', count: 2, results: [47, 100] },
    ])).batches;
    expect(batches.map(b => b.dice.length)).toEqual([19, 4]);
    expect(new Set(batches[1].dice.map(d => d.groupId)).size).toBe(2);
  });
  it('shows both attempts with kept result and their own plot dice', () => {
    const roll = makeRoll();
    const attempt = (n: number): RollAttempt => ({ dice: [{ type: 'd20', count: 1, results: [n] }], modifier: 0, subtotal: n, total: n + 4, plotDie: { face: 'complication_bonus_4', kind: 'complication', bonus: 4, label: 'Complication +4' } });
    roll.rollResults = { ...roll.rollResults, attempts: [attempt(3), attempt(18)], mode: 'advantage', keptAttemptIndex: 1, total: 22 };
    const result = buildRollPresentation(roll);
    expect(result.batches.map(b => [b.attemptIndex, b.kept, b.total])).toEqual([[0, false, 7], [1, true, 22]]);
    expect(result.batches[1].dice[1]).toMatchObject({ sides: 6, kind: 'plot', value: 6, label: 'Complication +4' });
  });
  it('uses readable fallback for unsupported dice and never fabricates a shape', () => {
    const result = buildRollPresentation(makeRoll([{ type: 'd7', count: 1, results: [5] }]));
    expect(result.batches[0].dice).toEqual([]);
    expect(result.batches[0].summary).toContain('d7: 5');
  });
  it('bounds rendering of oversized legacy rolls', () => {
    const result = buildRollPresentation(makeRoll([{ type: 'd6', count: 1000, results: Array(1000).fill(6) }]));
    expect(result.batches).toHaveLength(1);
    expect(result.batches[0].dice).toHaveLength(0);
    expect(result.batches[0].summary).toContain('history');
  });
});

describe('animation visibility', () => {
  it('requires matching session and enforces public, gm-only, and self visibility', () => {
    const roll = makeRoll();
    const viewer = { username: 'Kaladin', isGm: false };
    expect(canViewRoll(roll, 'other', viewer)).toBe(false);
    expect(canViewRoll(roll, 'table', null)).toBe(false);
    expect(canViewRoll(roll, 'table', viewer)).toBe(true);
    roll.visibility = 'gm_only';
    expect(canViewRoll(roll, 'table', viewer)).toBe(false);
    expect(canViewRoll(roll, 'table', { ...viewer, isGm: true })).toBe(true);
    roll.visibility = 'self';
    expect(canViewRoll(roll, 'table', viewer)).toBe(true);
    expect(canViewRoll(roll, 'table', { username: 'Shallan', isGm: true })).toBe(false);
  });
});
