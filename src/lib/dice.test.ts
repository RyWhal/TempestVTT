import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildDiceExpression, createRollResults, validateRollRequest } from './dice';

describe('validateRollRequest', () => {
  it('rejects modifier-only rolls', () => {
    expect(validateRollRequest('+2')).toEqual({
      valid: false,
      error: 'Select at least one die to roll.',
    });
  });

  it('requires at least one d20 when the plot die is enabled', () => {
    expect(validateRollRequest('2d6+1', { plotDieEnabled: true })).toEqual({
      valid: false,
      error: 'Plot die requires at least one d20 in the roll.',
    });
  });
});

describe('buildDiceExpression', () => {
  it('formats positive modifiers without duplicating the plus separator', () => {
    expect(
      buildDiceExpression({ 8: 1, 10: 1, 12: 1, 20: 1 }, 4)
    ).toBe('1d8+1d10+1d12+1d20+4');
  });

  it('formats negative modifiers without inserting a literal plus-minus sequence', () => {
    expect(
      buildDiceExpression({ 8: 1, 10: 1, 12: 1, 20: 1 }, -4)
    ).toBe('1d8+1d10+1d12+1d20-4');
  });
});

describe('createRollResults', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('applies plot-die complication bonuses to the final total', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.95);

    const results = createRollResults('1d20+2', { plotDieEnabled: true });

    expect(results.total).toBe(7);
    expect(results.plotDie).toMatchObject({
      face: 'complication_bonus_4',
      kind: 'complication',
      bonus: 4,
    });
    expect(results.attempts?.[0]?.plotDie).toMatchObject({
      face: 'complication_bonus_4',
      kind: 'complication',
      bonus: 4,
    });
  });

  it('rolls the full recipe twice and keeps the higher total for advantage', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.95)
      .mockReturnValueOnce(0.83);

    const results = createRollResults('1d20+1d6+1', { mode: 'advantage' });

    expect(results.mode).toBe('advantage');
    expect(results.attempts?.map((attempt) => attempt.total)).toEqual([3, 26]);
    expect(results.keptAttemptIndex).toBe(1);
    expect(results.total).toBe(26);
    expect(results.dice).toEqual(results.attempts?.[1]?.dice);
  });

  it('rolls the full recipe twice and keeps the lower total for disadvantage', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.95)
      .mockReturnValueOnce(0.83)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0);

    const results = createRollResults('1d20+1d6+1', { mode: 'disadvantage' });

    expect(results.mode).toBe('disadvantage');
    expect(results.attempts?.map((attempt) => attempt.total)).toEqual([26, 3]);
    expect(results.keptAttemptIndex).toBe(1);
    expect(results.total).toBe(3);
    expect(results.dice).toEqual(results.attempts?.[1]?.dice);
  });
});
