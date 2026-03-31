import { describe, expect, it } from 'vitest';
import { resolveDisplayedBiomeName } from './biomeDisplay';

describe('biomeDisplay', () => {
  it('prefers the current section biome label over stale generated content biome text', () => {
    const biomeNamesById = new Map([
      ['ice_vault', 'Ice Vault'],
      ['stone_halls', 'Old Stone Halls'],
    ]);

    expect(
      resolveDisplayedBiomeName({
        biomeId: 'ice_vault',
        contentBiomeName: 'Old Stone Halls',
        biomeNamesById,
      })
    ).toBe('Ice Vault');
  });

  it('falls back to generated content biome text when no biome id is available', () => {
    expect(
      resolveDisplayedBiomeName({
        biomeId: null,
        contentBiomeName: 'Old Stone Halls',
        biomeNamesById: new Map(),
      })
    ).toBe('Old Stone Halls');
  });
});
