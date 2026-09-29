/** Physical dice, including percentile pairs and both advantage/disadvantage attempts. */
export const MAX_ROLL_DICE = 100;
export const MAX_VISIBLE_DICE = 20;
export const physicalDiceCount = (sides: number, count: number) => Math.abs(count) * (sides === 100 ? 2 : 1);
