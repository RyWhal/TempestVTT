export const PLAYER_ACCENTS = [
  ['Sky', '#60a5fa'], ['Pink', '#f472b6'], ['Emerald', '#34d399'], ['Amber', '#fbbf24'],
  ['Violet', '#a78bfa'], ['Cyan', '#22d3ee'], ['Orange', '#fb923c'], ['Coral', '#f87171'],
  ['Lime', '#a3e635'], ['Orchid', '#e879f9'], ['Teal', '#2dd4bf'], ['Lavender', '#c4b5fd'],
  ['Rose', '#fda4af'], ['Pear', '#bef264'], ['Ice', '#93c5fd'], ['Gold', '#fcd34d'],
] as const;
export const NEUTRAL_ACCENT = '#cbd5e1';
export interface PlayerAccentReservation { username: string; color: string; expiresAt: string }
export function accentForPlayer(reservations: PlayerAccentReservation[], username: string | null | undefined) {
  return reservations.find((r) => r.username === username && Date.parse(r.expiresAt) > Date.now())?.color ?? NEUTRAL_ACCENT;
}
