import { describe, expect, it } from 'vitest';
import { formatNPCHp, parseNPCHp } from './npcHp';

describe('NPC HP notes envelopes', () => {
  it.each(['{"quest":"bridge"}', '{"hp":12,"secret":"keep"}', '{"notes":"ordinary JSON"}', '{"hp":"12"}', '{"hp":12,"notes":42}', '[1,2]', '{broken}'])('preserves arbitrary notes %s through HP edits', (notes) => {
    expect(parseNPCHp(notes)).toEqual({ hp: 30, maxHp: 30, notes });
    expect(parseNPCHp(formatNPCHp(20, 30, parseNPCHp(notes).notes)).notes).toBe(notes);
  });

  it('reads valid envelopes and preserves their prose', () => {
    expect(parseNPCHp('{"hp":12,"maxHp":40,"notes":"Protect the bridge"}'))
      .toEqual({ hp: 12, maxHp: 40, notes: 'Protect the bridge' });
    expect(parseNPCHp('{"hp":12}')).toEqual({ hp: 12, maxHp: 12, notes: '' });
    expect(parseNPCHp('{"maxHp":40}')).toEqual({ hp: 40, maxHp: 40, notes: '' });
  });
});
