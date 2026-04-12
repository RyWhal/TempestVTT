import type { PlotDieFace, PlotDieResult, RollAttempt, RollMode, RollResults } from '../types';

// Dice notation parser and roller

interface ParsedDice {
  dice: { count: number; sides: number }[];
  modifier: number;
}

interface RollRequestOptions {
  mode?: RollMode;
  plotDieEnabled?: boolean;
}

interface RollValidationResult {
  valid: boolean;
  error?: string;
  parsed?: ParsedDice;
}

/**
 * Parse a dice notation string like "2d20+1d6+5" or "3d6-2"
 */
export const parseDiceNotation = (expression: string): ParsedDice => {
  const result: ParsedDice = {
    dice: [],
    modifier: 0,
  };

  // Remove spaces and convert to lowercase
  const cleaned = expression.replace(/\s/g, '').toLowerCase();

  // Match patterns like "2d20", "d6", "+5", "-3"
  const pattern = /([+-]?\d*d\d+)|([+-]\d+)/g;
  let match;

  while ((match = pattern.exec(cleaned)) !== null) {
    const token = match[0];

    if (token.includes('d')) {
      // It's a dice roll
      const parts = token.replace(/^\+/, '').split('d');
      const count = parts[0] === '' || parts[0] === '-' ? 1 : Math.abs(parseInt(parts[0], 10));
      const sides = parseInt(parts[1], 10);
      const isNegative = token.startsWith('-');

      if (count > 0 && sides > 0 && count <= 100 && sides <= 100) {
        result.dice.push({
          count: isNegative ? -count : count,
          sides,
        });
      }
    } else {
      // It's a modifier
      result.modifier += parseInt(token, 10);
    }
  }

  return result;
};

/**
 * Roll a single die with the given number of sides
 */
export const rollDie = (sides: number): number => {
  return Math.floor(Math.random() * sides) + 1;
};

/**
 * Roll dice based on parsed notation
 */
export const rollDice = (parsed: ParsedDice): RollResults => {
  const results = parsed.dice.map((d) => ({
    type: `d${d.sides}`,
    count: Math.abs(d.count),
    results: Array(Math.abs(d.count))
      .fill(0)
      .map(() => rollDie(d.sides)),
    isNegative: d.count < 0,
  }));

  const diceTotal = results.reduce((sum, r) => {
    const subtotal = r.results.reduce((a, b) => a + b, 0);
    return r.isNegative ? sum - subtotal : sum + subtotal;
  }, 0);

  const total = diceTotal + parsed.modifier;

  return {
    dice: results.map((r) => ({
      type: r.type,
      count: r.count,
      results: r.results,
    })),
    modifier: parsed.modifier,
    total,
  };
};

/**
 * Parse and roll dice from a string expression
 */
export const parseAndRoll = (expression: string): RollResults => {
  return createRollResults(expression);
};

// Tempest Plot Dice
const PLOT_DIE_FACES: PlotDieResult[] = [
  { face: 'opportunity', kind: 'opportunity', bonus: 0, label: 'Opportunity' },
  { face: 'opportunity', kind: 'opportunity', bonus: 0, label: 'Opportunity' },
  { face: 'blank', kind: 'blank', bonus: 0, label: 'Blank' },
  { face: 'blank', kind: 'blank', bonus: 0, label: 'Blank' },
  { face: 'complication_bonus_2', kind: 'complication', bonus: 2, label: 'Complication +2' },
  { face: 'complication_bonus_4', kind: 'complication', bonus: 4, label: 'Complication +4' },
];

/**
 * Roll a single plot die
 */
export const rollPlotDie = (): PlotDieResult => {
  const result = PLOT_DIE_FACES[Math.floor(Math.random() * 6)];
  return { ...result };
};

/**
 * Roll multiple plot dice
 */
export const rollPlotDice = (count: number): PlotDieResult[] => {
  return Array(count)
    .fill(0)
    .map(() => rollPlotDie());
};

export const normalizePlotDieResult = (
  plotDie: Pick<PlotDieResult, 'face'> & Partial<PlotDieResult>
): PlotDieResult => {
  switch (plotDie.face) {
    case 'opportunity':
      return {
        face: plotDie.face,
        kind: 'opportunity',
        bonus: 0,
        label: 'Opportunity',
      };
    case 'blank':
      return {
        face: plotDie.face,
        kind: 'blank',
        bonus: 0,
        label: 'Blank',
      };
    case 'complication':
      return {
        face: plotDie.face,
        kind: 'complication',
        bonus: 0,
        label: 'Complication',
      };
    case 'complication_bonus_2':
      return {
        face: plotDie.face,
        kind: 'complication',
        bonus: 2,
        label: 'Complication +2',
      };
    case 'complication_bonus_4':
      return {
        face: plotDie.face,
        kind: 'complication',
        bonus: 4,
        label: 'Complication +4',
      };
  }
};

export const validateRollRequest = (
  expression: string,
  options: Pick<RollRequestOptions, 'plotDieEnabled'> = {}
): RollValidationResult => {
  const parsed = parseDiceNotation(expression);
  const hasStandardDice = parsed.dice.some((die) => Math.abs(die.count) > 0);

  if (!hasStandardDice) {
    return {
      valid: false,
      error: 'Select at least one die to roll.',
    };
  }

  if (options.plotDieEnabled) {
    const hasD20 = parsed.dice.some((die) => die.sides === 20 && Math.abs(die.count) > 0);
    if (!hasD20) {
      return {
        valid: false,
        error: 'Plot die requires at least one d20 in the roll.',
      };
    }
  }

  return {
    valid: true,
    parsed,
  };
};

const createAttempt = (parsed: ParsedDice, plotDieEnabled = false): RollAttempt => {
  const baseRoll = rollDice(parsed);
  const plotDie = plotDieEnabled ? rollPlotDie() : null;

  return {
    dice: baseRoll.dice,
    modifier: baseRoll.modifier,
    subtotal: baseRoll.total,
    total: baseRoll.total + (plotDie?.bonus ?? 0),
    plotDie,
  };
};

export const createRollResults = (
  expression: string,
  options: RollRequestOptions = {}
): RollResults => {
  const { mode = 'normal', plotDieEnabled = false } = options;
  const validation = validateRollRequest(expression, { plotDieEnabled });

  if (!validation.valid || !validation.parsed) {
    throw new Error(validation.error || 'Invalid roll');
  }

  const attemptCount = mode === 'normal' ? 1 : 2;
  const attempts = Array.from({ length: attemptCount }, () =>
    createAttempt(validation.parsed as ParsedDice, plotDieEnabled)
  );

  const keptAttemptIndex =
    mode === 'advantage'
      ? attempts[1].total > attempts[0].total
        ? 1
        : 0
      : mode === 'disadvantage'
        ? attempts[1].total < attempts[0].total
          ? 1
          : 0
        : 0;

  const keptAttempt = attempts[keptAttemptIndex];

  return {
    dice: keptAttempt.dice,
    modifier: keptAttempt.modifier,
    total: keptAttempt.total,
    mode,
    expression,
    attempts,
    keptAttemptIndex,
    plotDie: keptAttempt.plotDie,
  };
};

/**
 * Format roll results as a readable string
 */
export const formatRollResults = (results: RollResults): string => {
  const diceParts = results.dice.map((d) => {
    const values = d.results.join(', ');
    return `${d.count}${d.type}: [${values}]`;
  });

  const modifierPart =
    results.modifier !== 0
      ? results.modifier > 0
        ? ` + ${results.modifier}`
        : ` - ${Math.abs(results.modifier)}`
      : '';

  return `${diceParts.join(' + ')}${modifierPart} = ${results.total}`;
};

/**
 * Get display name for plot die face
 */
export const getPlotDieFaceName = (face: PlotDieFace): string => {
  switch (face) {
    case 'opportunity':
      return 'Opportunity';
    case 'blank':
      return 'Blank';
    case 'complication':
      return 'Complication';
    case 'complication_bonus_2':
      return 'Complication +2';
    case 'complication_bonus_4':
      return 'Complication +4';
  }
};

/**
 * Build a dice expression from UI state
 */
export const buildDiceExpression = (
  dice: Record<number, number>,
  modifier: number
): string => {
  const diceParts: string[] = [];

  // Standard dice sizes
  const diceTypes = [4, 6, 8, 10, 12, 20];

  for (const sides of diceTypes) {
    const count = dice[sides] || 0;
    if (count > 0) {
      diceParts.push(`${count}d${sides}`);
    }
  }

  const diceExpression = diceParts.join('+');

  if (modifier === 0) {
    return diceExpression || '0';
  }

  if (!diceExpression) {
    return `${modifier}`;
  }

  return modifier > 0
    ? `${diceExpression}+${modifier}`
    : `${diceExpression}${modifier}`;
};
