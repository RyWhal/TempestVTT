import type { PlotDieFace, RollResults } from '../types';

// Dice notation parser and roller

interface ParsedDice {
  dice: { count: number; sides: number }[];
  modifier: number;
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
  const parsed = parseDiceNotation(expression);
  return rollDice(parsed);
};

// Tempest Plot Dice
const PLOT_DIE_FACES: PlotDieFace[] = [
  'blank',
  'blank',
  'opportunity',
  'opportunity',
  'complication',
  'complication',
];

/**
 * Roll a single plot die
 */
export const rollPlotDie = (): PlotDieFace => {
  return PLOT_DIE_FACES[Math.floor(Math.random() * 6)];
};

/**
 * Roll multiple plot dice
 */
export const rollPlotDice = (count: number): PlotDieFace[] => {
  return Array(count)
    .fill(0)
    .map(() => rollPlotDie());
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
    case 'complication':
      return 'Complication';
    case 'blank':
      return 'Blank';
  }
};

/**
 * Build a dice expression from UI state
 */
export const buildDiceExpression = (
  dice: Record<number, number>,
  modifier: number
): string => {
  const parts: string[] = [];

  // Standard dice sizes
  const diceTypes = [4, 6, 8, 10, 12, 20];

  for (const sides of diceTypes) {
    const count = dice[sides] || 0;
    if (count > 0) {
      parts.push(`${count}d${sides}`);
    }
  }

  if (modifier !== 0) {
    if (modifier > 0) {
      parts.push(`+${modifier}`);
    } else {
      parts.push(`${modifier}`);
    }
  }

  return parts.join('+') || '0';
};
