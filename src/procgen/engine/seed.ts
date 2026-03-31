import type { SectionSeedInput } from '../types';

export const hashString = (value: string): string => {
  let hash = 2166136261;

  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
};

export const createSeededRandom = (seed: string) => {
  let state = 0;

  for (let index = 0; index < seed.length; index++) {
    state = (state * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

export const deriveSectionSeed = ({
  worldSeed,
  sectionId,
}: SectionSeedInput): string => {
  return `section_${hashString(`${worldSeed}:${sectionId}`)}`;
};
