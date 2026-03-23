import { contentRegistry } from '../content/contentRegistry';
import type { Biome, GeneratedSection, SectionKind } from '../types';
import { createSeededRandom, hashString } from './seed';

const asString = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback;

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const toTitleCase = (value: string) =>
  value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(' ');

const uniqueWords = (items: string[]) => {
  const normalized = items
    .map((item) => item.trim())
    .filter(Boolean);

  return [...new Set(normalized)];
};

const pickOne = (items: string[], nextRandom: () => number, fallback: string) => {
  if (items.length === 0) {
    return fallback;
  }

  return items[Math.floor(nextRandom() * items.length)] ?? fallback;
};

const fallbackAdjectives = [
  'Ash',
  'Cinder',
  'Gloam',
  'Hollow',
  'Iron',
  'Mire',
  'Moss',
  'Root',
  'Stone',
  'Umber',
];

const explorationNouns = [
  'Archive',
  'Bastion',
  'Chapel',
  'Channel',
  'Court',
  'Crucible',
  'Gallery',
  'Hollow',
  'Sanctum',
  'Span',
  'Vault',
  'Warren',
];

const settlementNouns = [
  'Crossing',
  'Gate',
  'Green',
  'Hearth',
  'Hold',
  'Market',
  'Quarter',
  'Row',
  'Square',
  'Yard',
];

const getBiome = (section: GeneratedSection): Biome => {
  const biomes = contentRegistry.loadPack('biomes').biomes;

  return (
    biomes.find((candidate) => candidate.id === section.primaryBiomeId) ??
    biomes.find((candidate) => candidate.id === 'stone_halls') ??
    biomes[0]
  );
};

const buildDescriptorPool = (biome: Biome) =>
  uniqueWords([
    ...asString(biome.name, biome.id).split(/[\s_-]+/),
    ...asStringArray((biome as Record<string, unknown>).tags),
    ...asStringArray((biome as Record<string, unknown>).materials),
    ...asStringArray((biome as Record<string, unknown>).hazards),
  ])
    .map(toTitleCase)
    .filter((word) => !['The', 'And', 'Of'].includes(word));

const buildNounPool = (biome: Biome, sectionKind: SectionKind) =>
  uniqueWords([
    ...asString(biome.name, biome.id).split(/[\s_-]+/).slice(1).map(toTitleCase),
    ...(sectionKind === 'settlement' ? settlementNouns : explorationNouns),
  ]);

export const generateSectionLabel = ({
  worldSeed,
  sectionId,
  section,
}: {
  worldSeed: string;
  sectionId: string;
  section: GeneratedSection;
}): string => {
  const biome = getBiome(section);
  const nextRandom = createSeededRandom(`${worldSeed}:${sectionId}:label:${hashString(section.primaryBiomeId)}`);
  const descriptor = pickOne(buildDescriptorPool(biome), nextRandom, pickOne(fallbackAdjectives, nextRandom, 'Stone'));
  const noun = pickOne(
    buildNounPool(biome, section.sectionKind),
    nextRandom,
    section.sectionKind === 'settlement' ? 'Hold' : 'Vault'
  );

  const secondaryDescriptorPool =
    section.sectionKind === 'settlement'
      ? ['Lantern', 'Way', 'Market', 'Watch', 'Hearth', 'Bell']
      : ['Deep', 'Black', 'Silent', 'Crown', 'Glass', 'Ember'];
  const secondaryDescriptor = pickOne(secondaryDescriptorPool, nextRandom, 'Stone');

  const variants = [
    `${descriptor} ${noun}`,
    `${secondaryDescriptor} ${noun}`,
    `${descriptor}${noun}`,
  ];

  return variants[Math.floor(nextRandom() * variants.length)] ?? `${descriptor} ${noun}`;
};
