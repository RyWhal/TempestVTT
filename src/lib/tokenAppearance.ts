/** Legacy or malformed session data must not accidentally hide every token. */
export const normalizeTokenOpacity = (value: number | null | undefined): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? value : 1;
