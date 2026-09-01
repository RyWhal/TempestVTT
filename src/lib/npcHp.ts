export interface NPCHpState {
  hp: number;
  maxHp: number;
  notes: string;
}

export function parseNPCHp(notes?: string | null, fallbackHp = 30): NPCHpState {
  if (!notes) {
    return { hp: fallbackHp, maxHp: fallbackHp, notes: '' };
  }

  try {
    if (notes.startsWith('{') && notes.endsWith('}')) {
      const parsed = JSON.parse(notes);
      const max = typeof parsed.maxHp === 'number' ? parsed.maxHp : (typeof parsed.hp === 'number' ? parsed.hp : fallbackHp);
      const cur = typeof parsed.hp === 'number' ? parsed.hp : max;
      return {
        hp: Math.max(0, cur),
        maxHp: Math.max(1, max),
        notes: typeof parsed.notes === 'string' ? parsed.notes : '',
      };
    }
  } catch {
    // If not JSON, treat notes as raw string notes
  }

  return { hp: fallbackHp, maxHp: fallbackHp, notes };
}

export function formatNPCHp(hp: number, maxHp: number, notesStr: string = ''): string {
  return JSON.stringify({
    hp: Math.max(0, hp),
    maxHp: Math.max(1, maxHp),
    notes: notesStr,
  });
}
