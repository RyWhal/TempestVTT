import type { DiceRoll, PlotDieResult, RollAttempt } from '../../types';
import { MAX_ROLL_DICE, MAX_VISIBLE_DICE, physicalDiceCount } from '../../lib/diceLimits';

export type DieSides = 4 | 6 | 8 | 10 | 12 | 20;
export type DieKind = 'standard' | 'percentile-tens' | 'percentile-ones' | 'plot';
export interface DisplayDie {
  id: string;
  groupId: string;
  sides: DieSides;
  value: number;
  kind: DieKind;
  label: string;
}
export interface RollBatch {
  dice: DisplayDie[];
  summary: string;
  attemptIndex: number;
  kept: boolean;
  total: number;
  part: number;
  parts: number;
}
export interface RollPresentation {
  batches: RollBatch[];
  total: number;
  mode: string;
  attemptCount: number;
}

export function canViewRoll(
  roll: DiceRoll,
  sessionId: string | undefined,
  viewer: { username: string; isGm: boolean } | null,
): boolean {
  if (!viewer || roll.sessionId !== sessionId) return false;
  return roll.visibility === 'public'
    || (roll.visibility === 'gm_only' && viewer.isGm)
    || (roll.visibility === 'self' && roll.username === viewer.username);
}

export const PLOT_FACE_LABELS = ['Opportunity', 'Opportunity', 'Blank', 'Blank', 'Complication +2', 'Complication +4'];
const plotValues: Partial<Record<PlotDieResult['face'], number>> = {
  opportunity: 1, blank: 3, complication_bonus_2: 5, complication_bonus_4: 6,
};
const supportedSides = new Set([4, 6, 8, 10, 12, 20]);

export function buildRollPresentation(roll: DiceRoll): RollPresentation {
  const results = roll.rollResults;
  const attempts: RollAttempt[] = results.attempts?.length ? results.attempts : [{
    dice: results.dice, modifier: results.modifier, subtotal: results.total, total: results.total,
    plotDie: results.plotDie ?? roll.plotDiceResults?.[0] ?? null,
  }];
  const presentation: RollPresentation = {
    total: results.total, mode: results.mode ?? 'normal', attemptCount: attempts.length, batches: [],
  };
  // Old/imported rolls can exceed today's limit. Do not allocate unbounded geometry or queues.
  let count = 0;
  for (const attempt of attempts) {
    count += attempt.plotDie ? 1 : 0;
    for (const group of attempt.dice) count += physicalDiceCount(Number(group.type.slice(1)), group.results.length);
    if (count > MAX_ROLL_DICE || attempts.length > 2) {
      presentation.batches = [{ dice: [], summary: 'Large roll · full dice results in history', attemptIndex: 0, kept: true, total: results.total, part: 1, parts: 1 }];
      return presentation;
    }
  }

  attempts.forEach((attempt, attemptIndex) => {
    const batches: RollBatch[] = [];
    const newBatch = (): RollBatch => ({
      dice: [], summary: '', attemptIndex, kept: attemptIndex === (results.keptAttemptIndex ?? 0),
      total: attempt.total, part: 1, parts: 1,
    });
    let current = newBatch();
    const add = (dice: DisplayDie[], summary: string) => {
      if (current.dice.length + dice.length > MAX_VISIBLE_DICE) {
        batches.push(current);
        current = newBatch();
      }
      current.dice.push(...dice);
      current.summary += `${current.summary ? ' · ' : ''}${summary}`;
    };
    attempt.dice.forEach((group, groupIndex) => {
      const sides = Number(group.type.slice(1));
      group.results.forEach((value, index) => {
        const groupId = `${roll.id}-${attemptIndex}-${groupIndex}-${index}`;
        const valid = Number.isInteger(value) && value >= 1 && value <= sides;
        if (sides === 100 && valid) {
          const tens = Math.floor((value % 100) / 10);
          const ones = value % 10;
          add([
            { id: `${groupId}-t`, groupId, sides: 10, value: tens || 10, kind: 'percentile-tens', label: `${tens}0` },
            { id: `${groupId}-u`, groupId, sides: 10, value: ones || 10, kind: 'percentile-ones', label: `${ones}` },
          ], `d100: ${value} (${tens}0 + ${ones})`);
        } else if (supportedSides.has(sides) && valid) {
          add([{ id: groupId, groupId, sides: sides as DieSides, value, kind: 'standard', label: String(value) }], `${group.type}: ${value}`);
        } else {
          add([], `${group.type}: ${value}`);
        }
      });
    });
    if (attempt.plotDie) {
      const value = plotValues[attempt.plotDie.face];
      const id = `${roll.id}-${attemptIndex}-plot`;
      const label = value ? PLOT_FACE_LABELS[value - 1] : attempt.plotDie.label;
      add(value ? [{ id, groupId: id, sides: 6, value, kind: 'plot', label }] : [], `Plot: ${label}`);
    }
    batches.push(current);
    batches.forEach((batch, index) => { batch.part = index + 1; batch.parts = batches.length; });
    presentation.batches.push(...batches);
  });
  return presentation;
}
