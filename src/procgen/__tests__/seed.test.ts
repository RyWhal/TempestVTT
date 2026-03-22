import { describe, expect, it } from 'vitest';
import { deriveSectionSeed } from '../engine/seed';

describe('deriveSectionSeed', () => {
  it('returns the same seed for the same world seed and section id', () => {
    expect(
      deriveSectionSeed({
        worldSeed: 'world_ironbell_042',
        sectionId: 'section_start_001',
        state: 'preview',
      })
    ).toBe(
      deriveSectionSeed({
        worldSeed: 'world_ironbell_042',
        sectionId: 'section_start_001',
        state: 'preview',
      })
    );
  });

  it('returns different seeds for different section ids', () => {
    expect(
      deriveSectionSeed({
        worldSeed: 'world_ironbell_042',
        sectionId: 'section_start_001',
        state: 'preview',
      })
    ).not.toBe(
      deriveSectionSeed({
        worldSeed: 'world_ironbell_042',
        sectionId: 'section_002',
        state: 'preview',
      })
    );
  });

  it('does not change when lock state changes', () => {
    expect(
      deriveSectionSeed({
        worldSeed: 'world_ironbell_042',
        sectionId: 'section_start_001',
        state: 'preview',
      })
    ).toBe(
      deriveSectionSeed({
        worldSeed: 'world_ironbell_042',
        sectionId: 'section_start_001',
        state: 'locked',
      })
    );
  });
});
