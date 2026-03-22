import type { SectionSeedInput } from '../types';

const hashString = (value: string): string => {
  let hash = 2166136261;

  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
};

export const deriveSectionSeed = ({
  worldSeed,
  sectionId,
}: SectionSeedInput): string => {
  return `section_${hashString(`${worldSeed}:${sectionId}`)}`;
};
